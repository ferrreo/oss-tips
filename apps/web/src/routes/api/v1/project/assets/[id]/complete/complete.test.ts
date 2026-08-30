import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MalwareDetectedError, MalwareScannerUnavailableError } from '@oss-tips/storage';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/auth', () => ({
  checkProject: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return { ...actual, lockStorageObjectKeys: vi.fn() };
});

vi.mock('../../../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api-utils')>(
    '../../../../../api-utils',
  );
  return {
    ...actual,
    authorizeProject: vi.fn(async () => ({
      source: 'session',
      actor: { kind: 'user' },
      projectId: 'project-1',
      userId: 'user-1',
    })),
  };
});

vi.mock('$lib/server/storage', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
  return {
    ...actual,
    getStorage: vi.fn(),
    getQuarantineFlow: vi.fn(),
    readQuarantineObject: vi.fn(async () => new TextEncoder().encode('release notes')),
  };
});

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getQuarantineFlow, getStorage } from '$lib/server/storage';
import { POST } from './+server';
import { StorageQuotaExceededError } from '$lib/server/storage';

const row = {
  id: 'asset-1',
  project_id: 'project-1',
  purpose: 'attachment',
  visibility: 'private',
  storage_key: 'pending/upload_01',
  content_type: 'text/plain',
  byte_size: 13n,
};

function event() {
  const url = new URL('https://oss.tips/api/v1/project/assets/asset-1/complete');
  return {
    request: new Request(url, { method: 'POST' }),
    url,
    params: { id: 'asset-1' },
    locals: { session: { user: { id: 'user-1' } } },
  } as Parameters<typeof POST>[0];
}

function setup(error: Error) {
  const query = {
    select: vi.fn(() => query),
    where: vi.fn(() => query),
    executeTakeFirst: vi.fn(async () => row),
  };
  const db = {
    selectFrom: vi.fn(() => query),
    transaction: vi.fn(() => ({
      execute: vi.fn(async (callback: (trx: unknown) => Promise<unknown>) => callback({})),
    })),
  };
  const validateAndPromote = vi.fn(async () => {
    throw error;
  });
  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  vi.mocked(getStorage).mockReturnValue({} as never);
  vi.mocked(getQuarantineFlow).mockReturnValue({ validateAndPromote } as never);
  return { validateAndPromote };
}

describe('asset completion failure mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 503 without scanner internals when malware scanner is unavailable', async () => {
    setup(new MalwareScannerUnavailableError('scanner secret detail'));

    const response = await POST(event());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      title: 'Upload scanner unavailable',
      detail: 'Please try again later',
    });
    expect(JSON.stringify(body)).not.toContain('scanner secret detail');
  });

  it('returns 422 for malware detection without exposing scanner signature', async () => {
    setup(new MalwareDetectedError('Eicar-Test-Signature'));

    const response = await POST(event());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      title: 'Upload rejected',
      detail: 'Upload failed security checks',
    });
    expect(JSON.stringify(body)).not.toContain('Eicar-Test-Signature');
  });

  it('keeps quota and validation failures distinct', async () => {
    setup(new StorageQuotaExceededError());
    await expect(POST(event())).resolves.toMatchObject({ status: 413 });

    setup(new Error('invalid bytes'));
    await expect(POST(event())).resolves.toMatchObject({ status: 422 });
  });
});
