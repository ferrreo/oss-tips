import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cloudflare, getCloudflareClient } = vi.hoisted(() => ({
  cloudflare: {
    create: vi.fn(),
    findByHostname: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
  getCloudflareClient: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../api-utils')>('../../../api-utils');
  return {
    ...actual,
    authorizeProject: vi.fn(async () => ({
      source: 'session',
      projectId: 'project-1',
      userId: 'user-1',
    })),
    auditRecord: vi.fn(() => ({ id: 'audit-1' })),
  };
});

vi.mock('$lib/server/domain-runtime', () => ({
  domainResponse: vi.fn((row: unknown) => row),
  getCloudflareClient,
  markModeGrace: vi.fn(),
  providerFailure: vi.fn(),
  providerFields: vi.fn(),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { POST } from './+server';
import { POST as REFRESH } from './[id]/+server';
import { DELETE } from './[id]/+server';

type DomainRow = {
  id: string;
  project_id: string;
  hostname: string;
  status: string;
  provider_id: string | null;
  ssl_status: string | null;
  validation_method: string;
  validation_name: string | null;
  validation_value: string | null;
  cname_target: string | null;
  grace_until: Date | null;
  last_error: string | null;
  retry_at: Date | null;
  canonical_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

class DomainDb {
  readonly inserts: Array<{ table: string; value: unknown }> = [];
  readonly updates: Array<{ table: string; value: unknown }> = [];
  private readonly selectResults: unknown[];

  constructor(
    selectResults: unknown[],
    private readonly created?: DomainRow,
  ) {
    this.selectResults = [...selectResults];
  }

  selectFrom(_table: string) {
    const query: any = {
      select: () => query,
      selectAll: () => query,
      where: () => query,
      executeTakeFirst: async () => this.selectResults.shift(),
    };
    return query;
  }

  updateTable(table: string) {
    let value: unknown;
    const conditions: Array<[string, string, unknown]> = [];
    const query: any = {
      set: (next: unknown) => {
        value = next;
        return query;
      },
      where: (column: string, operator: string, expected: unknown) => {
        conditions.push([column, operator, expected]);
        return query;
      },
      returningAll: () => query,
      execute: async () => {
        if (!this.matches(conditions)) return [];
        this.updates.push({ table, value });
        if (this.created && table === 'custom_domain') Object.assign(this.created, value);
        return [];
      },
      executeTakeFirst: async () => {
        if (!this.matches(conditions)) return undefined;
        this.updates.push({ table, value });
        if (this.created && table === 'custom_domain') Object.assign(this.created, value);
        return this.created;
      },
      executeTakeFirstOrThrow: async () => {
        if (!this.matches(conditions)) throw new Error('missing update row');
        this.updates.push({ table, value });
        if (!this.created) throw new Error('missing update row');
        if (table === 'custom_domain') Object.assign(this.created, value);
        return this.created;
      },
    };
    return query;
  }

  private matches(conditions: Array<[string, string, unknown]>) {
    if (!this.created) return true;
    return conditions.every(([column, operator, expected]) => {
      const actual = this.created?.[column as keyof DomainRow];
      if (operator === '=') return actual === expected;
      if (operator === '<>') return actual !== expected;
      if (operator === 'is') return expected === null ? actual === null : actual === expected;
      return true;
    });
  }

  insertInto(table: string) {
    let value: unknown;
    const query: any = {
      values: (next: unknown) => {
        value = next;
        return query;
      },
      returningAll: () => query,
      execute: async () => {
        this.inserts.push({ table, value });
        return [];
      },
      executeTakeFirstOrThrow: async () => {
        this.inserts.push({ table, value });
        if (table !== 'custom_domain' || !this.created) throw new Error('missing insert row');
        return this.created;
      },
    };
    return query;
  }

  transaction() {
    return { execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this) };
  }
}

function row(overrides: Partial<DomainRow> = {}): DomainRow {
  return {
    id: 'domain-1',
    project_id: 'project-1',
    hostname: 'grove.dev',
    status: 'active',
    provider_id: 'cf-1',
    ssl_status: 'active',
    validation_method: 'txt',
    validation_name: null,
    validation_value: null,
    cname_target: null,
    grace_until: null,
    last_error: null,
    retry_at: null,
    canonical_enabled: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function event(request: Request, id = 'domain-1') {
  return {
    request,
    url: new URL(request.url),
    params: { id },
  } as unknown as Parameters<typeof DELETE>[0];
}

function createRequest(hostname = 'grove.dev') {
  return new Request('https://oss.tips/api/v1/project/domains', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostname }),
  });
}

describe('custom-domain lifecycle durability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    getCloudflareClient.mockReturnValue(cloudflare);
  });

  it('persists create intent and queues provisioning before any provider call', async () => {
    const created = row({ status: 'requested', provider_id: null, canonical_enabled: false });
    const db = new DomainDb([{ mode: 'contributes_5_percent' }, undefined, undefined], created);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event(createRequest()) as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(202);
    expect(cloudflare.create).not.toHaveBeenCalled();
    expect(db.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'job',
          value: expect.objectContaining({ kind: 'domain.provision' }),
        }),
        expect.objectContaining({ table: 'audit_event' }),
        expect.objectContaining({ table: 'outbox_event' }),
      ]),
    );
  });

  it('blocks hostname reuse while prior provider removal is pending', async () => {
    const db = new DomainDb([
      { mode: 'contributes_5_percent' },
      { provider_id: 'cf-old', retry_at: new Date('2026-01-03T00:00:00.000Z') },
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event(createRequest()) as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(409);
    expect(cloudflare.create).not.toHaveBeenCalled();
    expect(db.inserts).toEqual([]);
  });

  it('allows hostname reuse after provider removal is complete', async () => {
    const created = row({ status: 'requested', provider_id: null, canonical_enabled: false });
    const db = new DomainDb(
      [{ mode: 'contributes_5_percent' }, { provider_id: null, retry_at: null }, undefined],
      created,
    );
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event(createRequest()) as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(202);
    expect(db.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'job',
          value: expect.objectContaining({ kind: 'domain.provision' }),
        }),
      ]),
    );
  });

  it('does not refresh a domain after a concurrent delete', async () => {
    const current = row({ id: '11111111-1111-4111-8111-111111111111' });
    const db = new DomainDb([current, current], current);
    vi.mocked(getDb).mockReturnValue(db as never);
    const remote = {
      id: current.provider_id,
      hostname: current.hostname,
      status: 'active',
      sslStatus: 'active',
      validationRecords: [],
    };
    let resolveProvider!: (value: typeof remote) => void;
    const provider = new Promise<typeof remote>((resolve) => {
      resolveProvider = resolve;
    });
    cloudflare.get.mockReturnValueOnce(provider);

    const refreshPromise = REFRESH(
      event(
        new Request(`https://oss.tips/api/v1/project/domains/${current.id}`, {
          method: 'POST',
        }),
        current.id,
      ),
    );
    await vi.waitFor(() => expect(cloudflare.get).toHaveBeenCalledWith(current.provider_id));

    const deleteResponse = await DELETE(
      event(
        new Request(`https://oss.tips/api/v1/project/domains/${current.id}`, {
          method: 'DELETE',
        }),
        current.id,
      ),
    );
    expect(deleteResponse.status).toBe(204);

    resolveProvider(remote);
    const refreshResponse = await refreshPromise;

    expect(refreshResponse.status).toBe(404);
    expect(current.status).toBe('removed');
    expect(db.inserts.filter(({ table }) => table === 'audit_event')).toHaveLength(1);
    expect(db.inserts.filter(({ table }) => table === 'outbox_event')).toHaveLength(1);
  });

  it('queues delete intent without calling provider synchronously', async () => {
    const domainId = '11111111-1111-4111-8111-111111111111';
    const db = new DomainDb([row({ id: domainId })]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(
      event(
        new Request(`https://oss.tips/api/v1/project/domains/${domainId}`, {
          method: 'DELETE',
        }),
        domainId,
      ),
    );

    expect(response.status).toBe(204);
    expect(cloudflare.remove).not.toHaveBeenCalled();
    expect(db.updates[0]?.value).toMatchObject({
      status: 'removed',
      canonical_enabled: false,
      retry_at: expect.any(Date),
    });
    expect(db.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'job',
          value: expect.objectContaining({
            kind: 'domain.delete',
            payload: expect.objectContaining({ provider_id: 'cf-1' }),
          }),
        }),
        expect.objectContaining({ table: 'audit_event' }),
        expect.objectContaining({ table: 'outbox_event' }),
      ]),
    );
  });
});
