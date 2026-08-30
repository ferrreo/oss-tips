import { describe, expect, it, vi } from 'vitest';
import type { Db, Job } from '@oss-tips/db';
import { CloudflareApiError } from '@oss-tips/domain/cloudflare';
import { createJobHandlers, type JobHandlerDependencies } from './job-handlers.js';

function job(kind: string, payload: Record<string, unknown>): Job {
  return {
    id: 'job_123',
    queue: ['domain.challenge', 'domain.provision', 'domain.delete'].includes(kind)
      ? 'domains'
      : 'exports',
    kind,
    dedupe_key: null,
    payload: payload as Job['payload'],
    status: 'processing',
    attempt_count: 0,
    max_attempts: 5,
    run_at: new Date('2026-01-01T00:00:00.000Z'),
    locked_at: new Date('2026-01-01T00:00:00.000Z'),
    locked_by: 'worker-test',
    last_error: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function chain(result: unknown = undefined) {
  const value = {
    select: vi.fn(() => value),
    selectAll: vi.fn(() => value),
    leftJoin: vi.fn(() => value),
    innerJoin: vi.fn(() => value),
    where: vi.fn(() => value),
    forUpdate: vi.fn(() => value),
    orderBy: vi.fn(() => value),
    limit: vi.fn(() => value),
    set: vi.fn(() => value),
    values: vi.fn(() => value),
    returningAll: vi.fn(() => value),
    executeTakeFirst: vi.fn(async () => result),
    execute: vi.fn(async () => (Array.isArray(result) ? result : [])),
  };
  return value;
}

function exportDb() {
  const project = chain({ id: 'project_123' });
  const payments = chain([
    {
      id: 'payment_1',
      created_at: new Date('2026-01-02T00:00:00.000Z'),
      status: 'succeeded',
      cadence: 'one_off',
      currency: 'GBP',
      exponent: 2,
      customer_charge_minor: 1000n,
      project_amount_minor: 950n,
      platform_tip_minor: 25n,
      oss_project_fee_minor: 25n,
      stripe_application_fee_minor: 0n,
      stripe_payment_intent_id: 'pi_123',
      supporter_name: 'Ada',
    },
  ]);
  const asset = chain(undefined);
  const inserted = chain();
  const updatedJob = chain();
  const trx = {
    selectFrom: vi.fn(() => asset),
    updateTable: vi.fn((table: string) => (table === 'job' ? updatedJob : chain())),
    insertInto: vi.fn(() => inserted),
  };
  const db = {
    selectFrom: vi.fn((table: string) => (table === 'project' ? project : payments)),
    transaction: vi.fn(() => ({
      execute: vi.fn(async (callback: (trx: unknown) => unknown) => callback(trx)),
    })),
  } as unknown as Db;
  return { db, inserted, updatedJob };
}

function domainLifecycleDb(input: {
  status: string;
  providerId: string | null;
  transactionFailures?: number;
}) {
  const row = {
    id: 'domain_123',
    project_id: 'project_123',
    hostname: 'project.example',
    status: input.status,
    provider_id: input.providerId,
    ssl_status: null,
    validation_method: 'txt',
    validation_name: null,
    validation_value: null,
    cname_target: null,
    grace_until: null,
    last_error: null,
    retry_at: null,
    canonical_enabled: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
  const domain = chain(row);
  const update = chain();
  let whereCountAtSet = 0;
  update.set = vi.fn((changes: Record<string, unknown>) => {
    whereCountAtSet = (
      update.where as unknown as { mock: { calls: Array<[string, string, unknown]> } }
    ).mock.calls.length;
    return update;
  }) as typeof update.set;
  const shouldUpdate = () => {
    const guards = (
      update.where as unknown as { mock: { calls: Array<[string, string, unknown]> } }
    ).mock.calls.slice(whereCountAtSet);
    return !guards.some(
      ([column, operator, value]) =>
        column === 'status' && operator === '<>' && value === 'removed' && row.status === 'removed',
    );
  };
  update.executeTakeFirst = vi.fn(async () => {
    if (!shouldUpdate()) return undefined;
    const changes = (
      update.set as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }
    ).mock.calls.at(-1)?.[0];
    Object.assign(row, changes);
    return { ...row };
  });
  update.execute = vi.fn(async () => {
    if (shouldUpdate()) {
      const changes = (
        update.set as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }
      ).mock.calls.at(-1)?.[0];
      Object.assign(row, changes);
    }
    return [];
  });
  const inserted: Array<{ table: string; value: unknown }> = [];
  const trx = {
    selectFrom: vi.fn(() => domain),
    updateTable: vi.fn(() => update),
    insertInto: vi.fn((table: string) => {
      const query = chain();
      query.execute = vi.fn(async () => {
        const values = (
          query.values as unknown as { mock: { calls: Array<[unknown]> } }
        ).mock.calls.at(-1)?.[0];
        inserted.push({ table, value: values });
        return [];
      });
      return query;
    }),
  };
  let transactionCount = 0;
  const db = {
    selectFrom: vi.fn(() => domain),
    transaction: vi.fn(() => ({
      execute: vi.fn(async (callback: (trx: unknown) => unknown) => {
        transactionCount += 1;
        const snapshot = { ...row };
        const insertedCount = inserted.length;
        const result = await callback(trx);
        if (transactionCount <= (input.transactionFailures ?? 0)) {
          Object.assign(row, snapshot);
          inserted.splice(insertedCount);
          throw new Error('database unavailable');
        }
        return result;
      }),
    })),
  } as unknown as Db;
  return { db, row, inserted, update };
}

describe('worker job handlers', () => {
  it('writes a private, expiring payment export and records its asset', async () => {
    const { db, inserted, updatedJob } = exportDb();
    const putExport = vi.fn(async () => undefined);
    const dependencies: JobHandlerDependencies = {
      db,
      storage: { putExport },
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    };

    await createJobHandlers(dependencies)['project.export']?.(
      job('project.export', { project_id: 'project_123', kind: 'payments', format: 'json' }),
    );

    expect(putExport).toHaveBeenCalledWith(
      'exports/project_123/job_123.json',
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: 'application/json',
        expiresAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
    );
    expect(inserted.values).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'project_123',
        purpose: 'export',
        visibility: 'private',
        storage_key: 'exports/project_123/job_123.json',
        expires_at: new Date('2026-01-04T00:00:00.000Z'),
      }),
    );
    expect(updatedJob.set).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          storage_key: 'exports/project_123/job_123.json',
          expires_at: '2026-01-04T00:00:00.000Z',
        }),
      }),
    );
  });

  it('fails closed on malformed export payloads before writing storage', async () => {
    const putExport = vi.fn(async () => undefined);
    const dependencies: JobHandlerDependencies = {
      db: {} as Db,
      storage: { putExport },
    };
    await expect(
      createJobHandlers(dependencies)['project.export']?.(
        job('project.export', { project_id: '../escape', kind: 'payments', format: 'json' }),
      ),
    ).rejects.toThrow('project_id is invalid');
    expect(putExport).not.toHaveBeenCalled();
  });

  it('reuses provider hostname after a create succeeds but state persistence fails', async () => {
    const { db, row, inserted } = domainLifecycleDb({
      status: 'requested',
      providerId: null,
      transactionFailures: 1,
    });
    const remote = {
      id: 'cf_123',
      hostname: row.hostname,
      status: 'pending_validation',
      sslStatus: 'pending_validation',
      validationRecords: [],
    };
    const cloudflare = {
      create: vi.fn(async () => remote),
      findByHostname: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(remote),
      get: vi.fn(),
      remove: vi.fn(),
    };
    const dependencies = {
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    };
    const handler = createJobHandlers(dependencies)['domain.provision'];
    const provisionJob = job('domain.provision', {
      project_id: row.project_id,
      domain_id: row.id,
    });

    await expect(handler?.(provisionJob)).rejects.toMatchObject({
      runAt: new Date('2026-01-03T00:05:00.000Z'),
    });
    await expect(handler?.(provisionJob)).resolves.toBeUndefined();

    expect(cloudflare.create).toHaveBeenCalledTimes(1);
    expect(cloudflare.findByHostname).toHaveBeenCalledTimes(2);
    expect(row.provider_id).toBe(remote.id);
    expect(inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'audit_event' }),
        expect.objectContaining({ table: 'outbox_event' }),
        expect.objectContaining({
          table: 'job',
          value: expect.objectContaining({ kind: 'domain.challenge' }),
        }),
      ]),
    );
  });

  it('retries delete after provider success when final state persistence fails', async () => {
    const { db, row, inserted } = domainLifecycleDb({
      status: 'removed',
      providerId: 'cf_123',
      transactionFailures: 1,
    });
    const cloudflare = {
      create: vi.fn(),
      findByHostname: vi.fn(),
      get: vi.fn(),
      remove: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new CloudflareApiError('not found', 404)),
    };
    const dependencies = {
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    };
    const handler = createJobHandlers(dependencies)['domain.delete'];
    const deleteJob = job('domain.delete', {
      project_id: row.project_id,
      domain_id: row.id,
      provider_id: row.provider_id,
    });

    await expect(handler?.(deleteJob)).rejects.toMatchObject({
      runAt: new Date('2026-01-03T00:05:00.000Z'),
    });
    await expect(handler?.(deleteJob)).resolves.toBeUndefined();

    expect(cloudflare.remove).toHaveBeenCalledTimes(2);
    expect(row.provider_id).toBeNull();
    expect(inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'audit_event' }),
        expect.objectContaining({ table: 'outbox_event' }),
      ]),
    );
  });

  it('does not reprovision a completed create job when it is replayed', async () => {
    const { db, row, inserted } = domainLifecycleDb({
      status: 'awaiting_dns',
      providerId: 'cf_123',
    });
    const cloudflare = {
      create: vi.fn(),
      findByHostname: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(),
    };

    await createJobHandlers({
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
    })['domain.provision']?.(
      job('domain.provision', { project_id: row.project_id, domain_id: row.id }),
    );

    expect(cloudflare.create).not.toHaveBeenCalled();
    expect(cloudflare.findByHostname).not.toHaveBeenCalled();
    expect(cloudflare.get).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it('persists provider status before scheduling another domain challenge', async () => {
    const domainRow = { project_id: 'project_123', status: 'awaiting_dns', provider_id: 'cf_123' };
    const domain = chain(domainRow);
    const update = chain();
    const retry = chain();
    const trx = {
      updateTable: vi.fn(() => update),
      insertInto: vi.fn(() => retry),
    };
    const db = {
      selectFrom: vi.fn(() => domain),
      transaction: vi.fn(() => ({
        execute: vi.fn(async (callback: (trx: unknown) => unknown) => callback(trx)),
      })),
    } as unknown as Db;
    const cloudflare = {
      create: vi.fn(),
      get: vi.fn(async () => ({
        id: 'cf_123',
        hostname: 'project.example',
        status: 'pending_validation',
        sslStatus: 'pending_validation',
        validationRecords: [],
      })),
      remove: vi.fn(),
    };

    await expect(
      createJobHandlers({
        db,
        storage: { putExport: vi.fn() },
        cloudflare,
        now: () => new Date('2026-01-03T00:00:00.000Z'),
      })['domain.challenge']?.(
        job('domain.challenge', {
          project_id: 'project_123',
          domain_id: 'domain_123',
          provider_id: 'cf_123',
        }),
      ),
    ).rejects.toMatchObject({ runAt: new Date('2026-01-03T00:05:00.000Z') });

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'awaiting_dns', canonical_enabled: false }),
    );
    expect(retry.values).not.toHaveBeenCalled();
  });

  it('clears a missing provider and records completed removal', async () => {
    const { db, row, inserted } = domainLifecycleDb({
      status: 'active',
      providerId: 'cf_123',
    });
    const cloudflare = {
      create: vi.fn(),
      findByHostname: vi.fn(),
      get: vi.fn().mockRejectedValue(new CloudflareApiError('not found', 404)),
      remove: vi.fn(),
    };

    await createJobHandlers({
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    })['domain.challenge']?.(
      job('domain.challenge', {
        project_id: row.project_id,
        domain_id: row.id,
        provider_id: row.provider_id,
      }),
    );

    expect(row).toMatchObject({
      status: 'removed',
      provider_id: null,
      retry_at: null,
    });
    expect(inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'audit_event',
          value: expect.objectContaining({ action: 'domain.removal_completed' }),
        }),
        expect.objectContaining({
          table: 'outbox_event',
          value: expect.objectContaining({
            payload: expect.objectContaining({ change: 'removal_completed' }),
          }),
        }),
      ]),
    );
  });

  it('does not resurrect a domain removed while provider status is in flight', async () => {
    const { db, row } = domainLifecycleDb({
      status: 'active',
      providerId: 'cf_123',
    });
    const cloudflare = {
      create: vi.fn(),
      findByHostname: vi.fn(),
      get: vi.fn(async () => {
        Object.assign(row, {
          status: 'removed',
          retry_at: new Date('2026-01-03T00:00:00.000Z'),
        });
        return {
          id: 'cf_123',
          hostname: row.hostname,
          status: 'active',
          sslStatus: 'active',
          validationRecords: [],
        };
      }),
      remove: vi.fn(),
    };

    const handlers = createJobHandlers({
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
    });
    await handlers['domain.challenge']?.(
      job('domain.challenge', {
        project_id: row.project_id,
        domain_id: row.id,
        provider_id: row.provider_id,
      }),
    );

    expect(row.status).toBe('removed');
    await handlers['domain.delete']?.(
      job('domain.delete', {
        project_id: row.project_id,
        domain_id: row.id,
        provider_id: row.provider_id,
      }),
    );
    expect(cloudflare.remove).toHaveBeenCalledWith('cf_123');
  });

  it('uses a new durable audit id after domain recovery', async () => {
    const domainRows = [
      { project_id: 'project_123', status: 'active', provider_id: 'cf_123' },
      { project_id: 'project_123', status: 'failed', provider_id: 'cf_123' },
      { project_id: 'project_123', status: 'active', provider_id: 'cf_123' },
    ];
    const domain = chain(domainRows[0]);
    let domainLookup = 0;
    domain.executeTakeFirst = vi.fn(async () => domainRows[domainLookup++] ?? domainRows[2]);
    const update = chain(domainRows[0]);
    const emailJob = chain();
    const trx = {
      updateTable: vi.fn(() => update),
      insertInto: vi.fn(() => emailJob),
    };
    const db = {
      selectFrom: vi.fn(() => domain),
      transaction: vi.fn(() => ({
        execute: vi.fn(async (callback: (trx: unknown) => unknown) => callback(trx)),
      })),
    } as unknown as Db;
    const cloudflare = {
      create: vi.fn(),
      get: vi
        .fn()
        .mockRejectedValueOnce(new Error('provider unavailable'))
        .mockResolvedValueOnce({
          id: 'cf_123',
          hostname: 'project.example',
          status: 'active',
          sslStatus: 'active',
          validationRecords: [],
        })
        .mockRejectedValueOnce(new Error('provider unavailable')),
      remove: vi.fn(),
    };
    const challengeJob = job('domain.challenge', {
      project_id: 'project_123',
      domain_id: 'domain_123',
      provider_id: 'cf_123',
    });

    const dependencies = {
      db,
      storage: { putExport: vi.fn() },
      cloudflare,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    };
    const handler = createJobHandlers(dependencies)['domain.challenge'];
    await expect(handler?.(challengeJob)).rejects.toMatchObject({
      runAt: new Date('2026-01-03T00:05:00.000Z'),
    });
    await handler?.(challengeJob);
    await expect(handler?.(challengeJob)).rejects.toMatchObject({
      runAt: new Date('2026-01-03T00:05:00.000Z'),
    });

    const values = (
      emailJob.values as unknown as {
        mock: { calls: Array<[Record<string, unknown>]> };
      }
    ).mock.calls.map(([value]) => value);
    const audits = values
      .filter((value) => value.action === 'domain.verification_failed')
      .map((value) => value.id);
    const notifications = values
      .filter((value) => value.kind === 'email.notification')
      .map((value) => (value.payload as Record<string, unknown>).event_id);
    expect(audits).toHaveLength(2);
    expect(notifications).toEqual(audits);
    expect(audits[0]).not.toBe(audits[1]);
  });
});
