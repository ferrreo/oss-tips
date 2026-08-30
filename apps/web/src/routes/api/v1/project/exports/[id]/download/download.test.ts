import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/storage', () => ({ getStorage: vi.fn() }));

vi.mock('../../../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api-utils')>(
    '../../../../../api-utils',
  );
  return { ...actual, authorizeProject: vi.fn() };
});

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import { authorizeProject } from '../../../../../api-utils';
import { GET } from './+server';

const jobId = 'job_123';
const assetId = 'asset_123';
const storageKey = `exports/project_123/${jobId}.csv`;

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function event() {
  const url = new URL(
    `https://oss.tips/api/v1/project/exports/${jobId}/download?project_slug=grove`,
  );
  return {
    request: new Request(url),
    url,
    params: { id: jobId },
    locals: { session: { user: { id: 'user_123' } } },
  } as Parameters<typeof GET>[0];
}

function setup(input: { status?: string; expiresAt?: Date | null; projectId?: string } = {}) {
  const job = {
    id: jobId,
    status: input.status ?? 'completed',
    payload: {
      project_id: input.projectId ?? 'project_123',
      kind: 'payments',
      format: 'csv',
      asset_id: assetId,
    },
  };
  const asset = {
    id: assetId,
    project_id: 'project_123',
    purpose: 'export',
    visibility: 'private',
    storage_key: storageKey,
    content_type: 'text/csv',
    byte_size: 8n,
    expires_at: input.expiresAt ?? new Date('2099-01-01T00:00:00.000Z'),
    soft_deleted_at: null,
  };
  const db = {
    selectFrom: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        where: vi.fn(() => query),
        executeTakeFirst: vi.fn(async () => (table === 'job' ? job : asset)),
      };
      return query;
    }),
  };
  const getObjectStream = vi.fn(async () => ({
    body: stream(new TextEncoder().encode('a,b\n1,2\n')),
    contentLength: 8,
    contentType: 'text/csv',
  }));
  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(getStorage).mockReturnValue({ getObjectStream } as never);
  vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  vi.mocked(authorizeProject).mockResolvedValue({
    source: 'session',
    actor: { kind: 'user' },
    projectId: 'project_123',
    userId: 'user_123',
  } as never);
  return { db, getObjectStream };
}

describe('project export download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires project export capability before reading a job or object', async () => {
    setup();
    vi.mocked(authorizeProject).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await GET(event());

    expect(response.status).toBe(403);
    expect(getDb).toHaveBeenCalledOnce();
    expect(getStorage).not.toHaveBeenCalled();
  });

  it('streams a fresh completed export with private cache-safe headers', async () => {
    const { getObjectStream } = setup();

    const response = await GET(event());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="export.csv"');
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('a,b\n1,2\n');
    expect(getObjectStream).toHaveBeenCalledWith('oss-exports', storageKey);
  });

  it('rejects expired exports before touching storage', async () => {
    const { getObjectStream } = setup({ expiresAt: new Date('2020-01-01T00:00:00.000Z') });

    const response = await GET(event());

    expect(response.status).toBe(410);
    expect(getObjectStream).not.toHaveBeenCalled();
  });

  it('does not expose jobs from another project', async () => {
    const { getObjectStream } = setup({ projectId: 'project_other' });

    const response = await GET(event());

    expect(response.status).toBe(404);
    expect(getObjectStream).not.toHaveBeenCalled();
  });
});
