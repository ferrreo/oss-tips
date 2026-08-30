import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { WebhookEnvelopeSchema, type WebhookEnvelope } from '@oss-tips/api-contracts';
import { decryptWebhookSecret } from '@oss-tips/api-contracts/security';
import { checkWebhookDestination, isBlockedIp } from '@oss-tips/api-contracts/webhook-destination';
import {
  signWebhookPayload,
  WEBHOOK_API_VERSION,
  WEBHOOK_RETRY_SCHEDULE_SECONDS,
  uuidv7,
  type OutgoingEventType,
} from '@oss-tips/domain';
import { emailNotificationJob, type Db, type JsonValue } from '@oss-tips/db';

type Clock = () => Date;
type ResolveAddresses = (hostname: string) => Promise<Array<{ address: string }>>;
type Fetcher = typeof fetch;
type OutboxEvent = {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: JsonValue;
  created_at: Date;
};
type WebhookDelivery = {
  id: string;
  attempt_count: number;
  payload: JsonValue;
};

const defaultClock: Clock = () => new Date();
const defaultResolve: ResolveAddresses = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export function outgoingEventId(outboxId: string): string {
  return `evt_${outboxId}`;
}

export function deliveryEventId(eventId: string, endpointId: string): string {
  return `${eventId}:${endpointId}`;
}

function subscribes(events: string[], eventType: string): boolean {
  return events.some(
    (pattern) =>
      pattern === eventType ||
      (pattern.endsWith('*') && eventType.startsWith(pattern.slice(0, -1))),
  );
}

export function buildOutgoingEnvelope(
  row: Pick<OutboxEvent, 'id' | 'aggregate_id' | 'event_type' | 'payload' | 'created_at'>,
): WebhookEnvelope {
  const payload =
    typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  const projectId = typeof payload.project_id === 'string' ? payload.project_id : row.aggregate_id;
  return WebhookEnvelopeSchema.parse({
    id: outgoingEventId(row.id),
    type: row.event_type as OutgoingEventType,
    api_version: WEBHOOK_API_VERSION,
    created_at: row.created_at.toISOString(),
    project_id: projectId,
    data: { object: payload },
  });
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/** Fan out each unpublished outbox event into durable endpoint deliveries. */
export async function enqueueOutgoingDeliveries(
  db: Db,
  limit = 20,
  now = defaultClock(),
): Promise<number> {
  const events = await db
    .selectFrom('outbox_event')
    .selectAll()
    .where('published_at', 'is', null)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .execute();
  let published = 0;

  for (const event of events) {
    await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('outbox_event')
        .selectAll()
        .where('id', '=', event.id)
        .where('published_at', 'is', null)
        .forUpdate()
        .executeTakeFirst();
      if (!current) return;

      const envelope = buildOutgoingEnvelope(current);
      const endpoints = await trx
        .selectFrom('webhook_endpoint')
        .select(['id', 'events'])
        .where('project_id', '=', envelope.project_id)
        .where('is_active', '=', true)
        .execute();
      const eventId = outgoingEventId(current.id);

      for (const endpoint of endpoints) {
        if (!subscribes(endpoint.events, current.event_type)) continue;
        const deliveryId = deliveryEventId(eventId, endpoint.id);
        const existing = await trx
          .selectFrom('webhook_delivery')
          .select('id')
          .where('event_id', '=', deliveryId)
          .executeTakeFirst();
        if (existing) continue;
        try {
          await trx
            .insertInto('webhook_delivery')
            .values({
              id: uuidv7(),
              webhook_endpoint_id: endpoint.id,
              event_id: deliveryId,
              event_type: current.event_type,
              payload: asJson(envelope),
              status: 'pending',
              attempt_count: 0,
              next_attempt_at: now,
              last_response_status: null,
            })
            .execute();
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }

      await trx
        .updateTable('outbox_event')
        .set({ published_at: now })
        .where('id', '=', current.id)
        .execute();
      published += 1;
    });
  }
  return published;
}

export type DeliveryPlan = {
  status: 'delivered' | 'pending' | 'failed';
  attemptCount: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  disableEndpoint: boolean;
};

export function planDeliveryResult(input: {
  previousAttempts: number;
  responseStatus: number | null;
  now?: Date | undefined;
  random?: number | undefined;
}): DeliveryPlan {
  const now = input.now ?? defaultClock();
  const attemptCount = input.previousAttempts + 1;
  if (input.responseStatus !== null && input.responseStatus >= 200 && input.responseStatus < 300) {
    return {
      status: 'delivered',
      attemptCount,
      nextAttemptAt: null,
      responseStatus: input.responseStatus,
      disableEndpoint: false,
    };
  }
  if (attemptCount >= WEBHOOK_RETRY_SCHEDULE_SECONDS.length) {
    return {
      status: 'failed',
      attemptCount,
      nextAttemptAt: null,
      responseStatus: input.responseStatus,
      disableEndpoint: true,
    };
  }
  const baseSeconds = WEBHOOK_RETRY_SCHEDULE_SECONDS[attemptCount] ?? 43_200;
  const randomInput = input.random ?? Math.random();
  const random = Number.isFinite(randomInput) ? Math.max(0, Math.min(1, randomInput)) : 0.5;
  const jitteredSeconds = Math.round(baseSeconds * (0.8 + random * 0.4));
  return {
    status: 'pending',
    attemptCount,
    nextAttemptAt: new Date(now.getTime() + jitteredSeconds * 1000),
    responseStatus: input.responseStatus,
    disableEndpoint: false,
  };
}

async function assertPublicDestination(
  rawUrl: string,
  resolve: ResolveAddresses,
): Promise<{ url: URL; addresses: Array<{ address: string }> }> {
  const checked = checkWebhookDestination(rawUrl);
  if (!checked.ok) throw new Error(checked.reason);
  const addresses = await resolve(checked.url.hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error('Webhook URL resolves to a private address');
  }
  return { url: checked.url, addresses };
}

function postPinnedHttps(
  url: URL,
  address: string,
  headers: Record<string, string>,
  body: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = https.request(
      {
        hostname: address,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        servername: url.hostname.replace(/^\[|\]$/g, ''),
        headers: { ...headers, host: url.host },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        response.destroy();
        if (!settled) {
          settled = true;
          resolve(status);
        }
      },
    );
    const totalTimeout = setTimeout(
      () => request.destroy(new Error('Webhook request timeout')),
      10_000,
    );
    request.setTimeout(5_000, () => request.destroy(new Error('Webhook connection timeout')));
    request.once('error', (error) => {
      clearTimeout(totalTimeout);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    request.once('close', () => clearTimeout(totalTimeout));
    request.end(body);
  });
}

export async function sendWebhook(args: {
  url: string;
  secret: string;
  payload: Record<string, unknown>;
  now?: Date | undefined;
  fetcher?: Fetcher | undefined;
  resolve?: ResolveAddresses | undefined;
}): Promise<{ responseStatus: number | null }> {
  let destination: { url: URL; addresses: Array<{ address: string }> };
  try {
    destination = await assertPublicDestination(args.url, args.resolve ?? defaultResolve);
  } catch {
    return { responseStatus: null };
  }
  const url = destination.url;
  const rawBody = JSON.stringify(args.payload);
  const timestamp = Math.floor((args.now ?? defaultClock()).getTime() / 1000);
  const signature = signWebhookPayload({
    secret: args.secret,
    timestamp,
    rawBody,
  });
  try {
    const headers = {
      'content-type': 'application/json',
      'oss-tips-event-id': typeof args.payload.id === 'string' ? args.payload.id : '',
      'oss-tips-timestamp': String(timestamp),
      'oss-tips-signature': signature,
    };
    if (args.fetcher) {
      const response = await args.fetcher(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers,
        body: rawBody,
      });
      await response.body?.cancel();
      return { responseStatus: response.status };
    }
    const address = destination.addresses[0]?.address;
    if (!address) return { responseStatus: null };
    return { responseStatus: await postPinnedHttps(url, address, headers, rawBody) };
  } catch {
    return { responseStatus: null };
  }
}

type ClaimedDelivery = Pick<WebhookDelivery, 'id' | 'attempt_count' | 'payload'> & {
  endpoint_id: string;
  endpoint_url: string;
  secret_ciphertext: string;
  claimed_at: Date;
};

async function claimDelivery(db: Db, now: Date): Promise<ClaimedDelivery | undefined> {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('webhook_delivery')
      .innerJoin('webhook_endpoint', 'webhook_endpoint.id', 'webhook_delivery.webhook_endpoint_id')
      .select([
        'webhook_delivery.id',
        'webhook_delivery.attempt_count',
        'webhook_delivery.payload',
        'webhook_endpoint.id as endpoint_id',
        'webhook_endpoint.url as endpoint_url',
        'webhook_endpoint.secret_hash as secret_ciphertext',
      ])
      .where('webhook_endpoint.is_active', '=', true)
      .where((eb) =>
        eb.or([
          eb('webhook_delivery.status', '=', 'pending'),
          eb.and([
            eb('webhook_delivery.status', '=', 'processing'),
            eb('webhook_delivery.updated_at', '<=', new Date(now.getTime() - 10 * 60 * 1000)),
          ]),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb('webhook_delivery.next_attempt_at', 'is', null),
          eb('webhook_delivery.next_attempt_at', '<=', now),
        ]),
      )
      .orderBy('webhook_delivery.next_attempt_at', 'asc')
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!row) return undefined;
    await trx
      .updateTable('webhook_delivery')
      .set({ status: 'processing', updated_at: now })
      .where('id', '=', row.id)
      .execute();
    return { ...row, claimed_at: now };
  });
}

/** Claim and deliver one webhook, retaining the event ID across every retry. */
export async function deliverNextWebhook(
  db: Db,
  options: {
    encryptionKey: string;
    now?: Clock;
    random?: () => number;
    fetcher?: Fetcher;
    resolve?: ResolveAddresses;
  },
): Promise<DeliveryPlan | undefined> {
  const clock = options.now ?? defaultClock;
  const now = clock();
  const delivery = await claimDelivery(db, now);
  if (!delivery) return undefined;

  let responseStatus: number | null = null;
  try {
    const secret = decryptWebhookSecret(delivery.secret_ciphertext, options.encryptionKey);
    const result = await sendWebhook({
      url: delivery.endpoint_url,
      secret,
      payload: delivery.payload as Record<string, unknown>,
      now,
      fetcher: options.fetcher,
      resolve: options.resolve,
    });
    responseStatus = result.responseStatus;
  } catch {
    responseStatus = null;
  }
  const plan = planDeliveryResult({
    previousAttempts: delivery.attempt_count,
    responseStatus,
    now,
    random: options.random?.(),
  });
  await db.transaction().execute(async (trx) => {
    const completed = await trx
      .updateTable('webhook_delivery')
      .set({
        status: plan.status,
        attempt_count: plan.attemptCount,
        next_attempt_at: plan.nextAttemptAt,
        last_response_status: plan.responseStatus,
        updated_at: now,
      })
      .where('id', '=', delivery.id)
      .where('status', '=', 'processing')
      .where('updated_at', '=', delivery.claimed_at)
      .returning('id')
      .executeTakeFirst();
    if (!completed) return;
    if (plan.disableEndpoint) {
      const disabled = await trx
        .updateTable('webhook_endpoint')
        .set({ is_active: false, updated_at: now })
        .where('id', '=', delivery.endpoint_id)
        .where('is_active', '=', true)
        .returning('id')
        .executeTakeFirst();
      if (disabled) {
        const auditId = uuidv7();
        await trx
          .insertInto('audit_event')
          .values({
            id: auditId,
            actor_id: null,
            actor_type: 'system',
            session_id: null,
            action: 'webhook.disabled_after_failures',
            resource_type: 'webhook_endpoint',
            resource_id: disabled.id,
            project_id: null,
            reason: null,
            ip_hash: null,
            before_hash: null,
            after_hash: null,
            correlation_id: uuidv7(),
            metadata_redacted: { delivery_id: delivery.id, attempt_count: plan.attemptCount },
          })
          .execute();
        const endpoint = await trx
          .selectFrom('webhook_endpoint')
          .select('project_id')
          .where('id', '=', disabled.id)
          .executeTakeFirst();
        if (endpoint) {
          await trx
            .insertInto('outbox_event')
            .values({
              id: uuidv7(),
              aggregate_type: 'project',
              aggregate_id: endpoint.project_id,
              event_type: 'project.updated',
              payload: {
                project_id: endpoint.project_id,
                webhook_endpoint_id: disabled.id,
                change: 'disabled_after_failures',
              },
              published_at: null,
            })
            .execute();
          await trx
            .insertInto('job')
            .values(
              emailNotificationJob({
                notification: 'webhook-change',
                project_id: endpoint.project_id,
                webhook_endpoint_id: disabled.id,
                action: 'disabled',
                event_id: auditId,
              }),
            )
            .execute();
        }
      }
    }
  });
  return plan;
}
