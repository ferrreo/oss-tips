import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '@oss-tips/domain';
import { encryptWebhookSecret } from '@oss-tips/api-contracts/security';
import type { Db } from '@oss-tips/db';
import {
  buildOutgoingEnvelope,
  deliverNextWebhook,
  planDeliveryResult,
  sendWebhook,
} from './outgoing-webhooks.js';

describe('outgoing webhook delivery', () => {
  it('builds a versioned event envelope with a stable event id', () => {
    const envelope = buildOutgoingEnvelope({
      id: '00000000-0000-7000-8000-000000000001',
      aggregate_id: 'project-1',
      event_type: 'project.updated',
      payload: { project_id: 'project-1', name: 'Grove' },
      created_at: new Date('2026-08-28T20:00:00.000Z'),
    });
    expect(envelope.id).toBe('evt_00000000-0000-7000-8000-000000000001');
    expect(envelope.project_id).toBe('project-1');
    expect(envelope.api_version).toBe('2026-08-01');
  });

  it('schedules jittered retries and disables after the final attempt', () => {
    const now = new Date('2026-08-28T20:00:00.000Z');
    const retry = planDeliveryResult({
      previousAttempts: 0,
      responseStatus: 503,
      now,
      random: 0.5,
    });
    expect(retry.status).toBe('pending');
    expect(retry.attemptCount).toBe(1);
    expect(retry.nextAttemptAt?.getTime()).toBe(now.getTime() + 30_000);

    const exhausted = planDeliveryResult({ previousAttempts: 11, responseStatus: null, now });
    expect(exhausted.status).toBe('failed');
    expect(exhausted.disableEndpoint).toBe(true);
    expect(exhausted.nextAttemptAt).toBeNull();
  });

  it('signs the exact raw body and blocks private DNS answers', async () => {
    let received: { body: string; headers: Headers } | undefined;
    const ok = await sendWebhook({
      url: 'https://hooks.example.test/events',
      secret: 'whsec_test',
      payload: { id: 'evt_1', type: 'project.updated' },
      now: new Date('2026-08-28T20:00:00.000Z'),
      resolve: async () => [{ address: '203.0.113.10' }],
      fetcher: async (_input, init) => {
        received = { body: String(init?.body), headers: new Headers(init?.headers) };
        return new Response(null, { status: 204 });
      },
    });
    expect(ok.responseStatus).toBe(204);
    expect(received).toBeDefined();
    expect(
      verifyWebhookSignature({
        secret: 'whsec_test',
        timestampHeader: received?.headers.get('oss-tips-timestamp') ?? '',
        signatureHeader: received?.headers.get('oss-tips-signature') ?? '',
        rawBody: received?.body ?? '',
        nowSeconds: 1_787_947_200,
      }),
    ).toBe(true);

    let called = false;
    const blocked = await sendWebhook({
      url: 'https://hooks.example.test/events',
      secret: 'whsec_test',
      payload: { id: 'evt_2' },
      resolve: async () => [{ address: '127.0.0.1' }],
      fetcher: async () => {
        called = true;
        return new Response(null, { status: 204 });
      },
    });
    expect(blocked.responseStatus).toBeNull();
    expect(called).toBe(false);
  });

  it('does not let a stale worker overwrite a delivery taken over by another worker', async () => {
    const now = new Date('2026-08-28T20:00:00.000Z');
    const takeoverAt = new Date(now.getTime() + 1_000);
    const delivery = {
      id: 'delivery-1',
      endpoint_id: 'endpoint-1',
      endpoint_url: 'https://hooks.example.test/events',
      secret_ciphertext: encryptWebhookSecret('whsec_test', '11'.repeat(32)),
      payload: { id: 'evt_1', type: 'project.updated' },
      status: 'pending' as string,
      attempt_count: 0,
      updated_at: new Date(now.getTime() - 11 * 60_000),
      next_attempt_at: now,
      last_response_status: null as number | null,
    };
    let claimUpdate = false;
    let completionAttempt = false;

    const createDb = (): Db => {
      const fake: any = {};
      fake.transaction = () => ({
        execute: async (callback: (trx: Db) => unknown) => callback(fake),
      });
      fake.selectFrom = () => {
        const query: any = {
          innerJoin: () => query,
          select: () => query,
          where: () => query,
          orderBy: () => query,
          limit: () => query,
          forUpdate: () => query,
          skipLocked: () => query,
          executeTakeFirst: async () => {
            if (claimUpdate || delivery.status !== 'pending') return undefined;
            return {
              id: delivery.id,
              attempt_count: delivery.attempt_count,
              payload: delivery.payload,
              endpoint_id: delivery.endpoint_id,
              endpoint_url: delivery.endpoint_url,
              secret_ciphertext: delivery.secret_ciphertext,
            };
          },
        };
        return query;
      };
      fake.updateTable = () => {
        const conditions: Array<[string, string, unknown]> = [];
        let values: Record<string, unknown> = {};
        let returning = false;
        const query: any = {
          set: (next: Record<string, unknown>) => {
            values = next;
            return query;
          },
          where: (field: string, operator: string, value: unknown) => {
            conditions.push([field, operator, value]);
            return query;
          },
          returning: () => {
            returning = true;
            return query;
          },
          execute: async () => {
            if (!claimUpdate) {
              claimUpdate = true;
              Object.assign(delivery, values);
            }
            return [];
          },
          executeTakeFirst: async () => {
            completionAttempt = true;
            const claimedAt = conditions.find(([field]) => field === 'updated_at')?.[2];
            if (
              !returning ||
              delivery.status !== 'processing' ||
              !(claimedAt instanceof Date) ||
              delivery.updated_at.getTime() !== claimedAt.getTime()
            ) {
              return undefined;
            }
            Object.assign(delivery, values);
            return { id: delivery.id };
          },
        };
        return query;
      };
      return fake as Db;
    };

    const result = await deliverNextWebhook(createDb(), {
      encryptionKey: '11'.repeat(32),
      now: () => now,
      resolve: async () => [{ address: '203.0.113.10' }],
      fetcher: async () => {
        delivery.status = 'processing';
        delivery.attempt_count = 4;
        delivery.updated_at = takeoverAt;
        return new Response(null, { status: 500 });
      },
      random: () => 0.5,
    });

    expect(result?.status).toBe('pending');
    expect(completionAttempt).toBe(true);
    expect(delivery.status).toBe('processing');
    expect(delivery.attempt_count).toBe(4);
    expect(delivery.updated_at).toBe(takeoverAt);
  });
});
