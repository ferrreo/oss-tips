import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSET_LIMITS, LocalStorageClient } from '@oss-tips/storage';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/auth', () => ({
  checkProject: vi.fn(() => ({ allowed: true })),
}));

vi.mock('../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../api-utils')>('../../../api-utils');
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
  return { ...actual, getStorage: vi.fn() };
});

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import { PUT } from './[id]/upload/+server';

const LIMIT = ASSET_LIMITS.avatar;

type StreamFixture = {
  body: ReadableStream<Uint8Array>;
};

function stream(chunks: Uint8Array[]): StreamFixture {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
  return { body };
}

function request(fixture: StreamFixture, contentLength?: string): Request {
  return new Request('https://oss.tips/api/v1/project/assets/asset-1/upload', {
    method: 'PUT',
    ...(contentLength === undefined ? {} : { headers: { 'content-length': contentLength } }),
    body: fixture.body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

function event(uploadRequest: Request) {
  const url = new URL(uploadRequest.url);
  return {
    request: uploadRequest,
    url,
    params: { id: 'asset-1' },
    locals: { session: { user: { id: 'user-1' } } },
  } as Parameters<typeof PUT>[0];
}

function setup() {
  const fixture = {
    project_id: 'project-1',
    purpose: 'avatar',
    storage_key: 'pending/upload_01',
    content_type: 'image/png',
    visibility: 'public',
  };
  const query = {
    select: vi.fn(() => query),
    where: vi.fn(() => query),
    executeTakeFirst: vi.fn(async () => fixture),
  };
  const db = { selectFrom: vi.fn(() => query) };
  const storage = new LocalStorageClient('/tmp/oss-tips-upload-tests');
  const putLocal = vi.spyOn(storage, 'putLocal').mockResolvedValue();
  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(getStorage).mockReturnValue(storage);
  vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  return { putLocal };
}

describe('local asset upload body boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bounds chunked bodies at the purpose limit', async () => {
    const { putLocal } = setup();
    const fixture = stream([new Uint8Array(LIMIT), new Uint8Array(1)]);
    const uploadRequest = request(fixture);
    const arrayBuffer = vi.spyOn(uploadRequest, 'arrayBuffer');

    const response = await PUT(event(uploadRequest));

    expect(response.status).toBe(413);
    expect(putLocal).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('accepts a bounded chunked body without Content-Length', async () => {
    const { putLocal } = setup();
    const fixture = stream([new Uint8Array([1, 2, 3])]);

    const response = await PUT(event(request(fixture)));

    expect(response.status).toBe(204);
    expect(putLocal).toHaveBeenCalledOnce();
  });

  it('rejects a smaller declared length when actual bytes exceed the purpose limit', async () => {
    const { putLocal } = setup();
    const fixture = stream([new Uint8Array(LIMIT), new Uint8Array(1)]);
    const uploadRequest = request(fixture, '1');
    const arrayBuffer = vi.spyOn(uploadRequest, 'arrayBuffer');

    const response = await PUT(event(uploadRequest));

    expect(response.status).toBe(413);
    expect(putLocal).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it.each(['bad', '-1', '1.5', '1e3'])(
    'rejects malformed Content-Length %s before reading',
    async (value) => {
      const { putLocal } = setup();
      const fixture = stream([new Uint8Array([1])]);
      const response = await PUT(event(request(fixture, value)));

      expect(response.status).toBe(400);
      expect(putLocal).not.toHaveBeenCalled();
    },
  );

  it('rejects an under-limit body whose length conflicts with Content-Length', async () => {
    const { putLocal } = setup();
    const fixture = stream([new Uint8Array([1, 2])]);

    const response = await PUT(event(request(fixture, '1')));

    expect(response.status).toBe(400);
    expect(putLocal).not.toHaveBeenCalled();
  });

  it('rejects a declared length above the purpose limit before reading', async () => {
    const { putLocal } = setup();
    const fixture = stream([new Uint8Array([1])]);

    const response = await PUT(event(request(fixture, String(LIMIT + 1))));

    expect(response.status).toBe(413);
    expect(putLocal).not.toHaveBeenCalled();
  });

  it('accepts the exact purpose boundary and forwards exact bytes', async () => {
    const { putLocal } = setup();
    const body = new Uint8Array(LIMIT);
    body[0] = 1;
    const fixture = stream([body]);

    const response = await PUT(event(request(fixture, String(LIMIT))));

    expect(response.status).toBe(204);
    expect(putLocal).toHaveBeenCalledWith('oss-quarantine', 'pending/upload_01', body, 'image/png');
  });
});
