import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));
vi.mock('$lib/server/storage', () => ({ getStorage: vi.fn() }));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import { GET as GETMetadata } from '../../routes/api/v1/assets/[id]/+server';
import { GET as GETContent } from '../../routes/api/v1/assets/[id]/content/+server';

type Asset = {
  id: string;
  storage_key: string;
  content_type: string;
  byte_size: number;
  visibility: string;
  soft_deleted_at: Date | null;
};

type Variant = {
  object_asset_id: string;
  variant_name: 'sm' | 'md' | 'lg';
  storage_key: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  visibility: string;
};

class FakeDb {
  constructor(
    private readonly asset: Asset | null,
    private readonly variant: Variant | null = null,
  ) {}

  selectFrom(table: string) {
    const conditions = new Map<string, unknown>();
    const query = {
      select: () => query,
      where: (field: string, _operator: string, value: unknown) => {
        conditions.set(field, value);
        return query;
      },
      executeTakeFirst: async () => {
        const row = table === 'object_asset' ? this.asset : this.variant;
        if (!row) return undefined;
        return [...conditions.entries()].every(
          ([field, value]) => (row as Record<string, unknown>)[field] === value,
        )
          ? row
          : undefined;
      },
    };
    return query;
  }
}

const id = '11111111-1111-7111-8111-111111111111';
const storageKey =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png';

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    storage_key: storageKey,
    content_type: 'image/png',
    byte_size: 3,
    visibility: 'public',
    soft_deleted_at: null,
    ...overrides,
  };
}

function variant(overrides: Partial<Variant> = {}): Variant {
  return {
    object_asset_id: id,
    variant_name: 'sm',
    storage_key: storageKey.replace('.png', '.webp'),
    content_type: 'image/webp',
    byte_size: 2,
    width: 48,
    height: 48,
    visibility: 'public',
    ...overrides,
  };
}

function event(path: string) {
  const url = new URL(`https://oss.tips${path}`);
  return { request: new Request(url), url, params: { id } } as never;
}

function stream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe('public asset routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('keeps JSON metadata contract while returning same-origin URL', async () => {
    vi.mocked(getDb).mockReturnValue(new FakeDb(asset(), variant()) as never);

    const response = await GETMetadata(event(`/api/v1/assets/${id}?variant=sm`));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      url: `/api/v1/assets/${id}/content?variant=sm`,
      content_type: 'image/webp',
      content_length: 2,
      expires_at: null,
    });
  });

  it('streams only public bytes with content and cache headers', async () => {
    vi.mocked(getDb).mockReturnValue(new FakeDb(asset()) as never);
    const getObjectStream = vi.fn(async () => ({
      body: stream(new Uint8Array([1, 2, 3])),
      contentLength: 3,
      contentType: 'image/png',
    }));
    vi.mocked(getStorage).mockReturnValue({ getObjectStream } as never);

    const response = await GETContent(event(`/api/v1/assets/${id}/content`));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe('3');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(getObjectStream).toHaveBeenCalledWith('oss-public-media', storageKey);
  });

  it('rejects invalid variants, private records and length mismatches', async () => {
    expect((await GETContent(event(`/api/v1/assets/${id}/content?variant=original`))).status).toBe(
      400,
    );

    vi.mocked(getDb).mockReturnValue(new FakeDb(asset({ visibility: 'private' })) as never);
    expect((await GETContent(event(`/api/v1/assets/${id}/content`))).status).toBe(404);
    expect(getStorage).not.toHaveBeenCalled();

    vi.mocked(getDb).mockReturnValue(new FakeDb(asset()) as never);
    vi.mocked(getStorage).mockReturnValue({
      getObjectStream: vi.fn(async () => ({
        body: stream(new Uint8Array([1])),
        contentLength: 1,
        contentType: 'image/png',
      })),
    } as never);
    expect((await GETContent(event(`/api/v1/assets/${id}/content`))).status).toBe(503);

    vi.mocked(getStorage).mockReturnValue({
      getObjectStream: vi.fn(async () => ({
        body: stream(new Uint8Array([1, 2, 3])),
        contentLength: 3,
        contentType: 'text/html',
      })),
    } as never);
    expect((await GETContent(event(`/api/v1/assets/${id}/content`))).status).toBe(503);
  });
});
