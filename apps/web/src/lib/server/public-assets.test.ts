import { describe, expect, it } from 'vitest';
import {
  parsePublicAssetVariant,
  publicAssetContentUrl,
  publicAssetHeaders,
  publicAssetMetadata,
  resolvePublicAsset,
} from './public-assets';

type Asset = {
  id: string;
  storage_key: string;
  content_type: string;
  byte_size: number | bigint | string;
  visibility: string;
  soft_deleted_at: Date | null;
};

type Variant = {
  object_asset_id: string;
  variant_name: 'sm' | 'md' | 'lg';
  storage_key: string;
  content_type: string;
  byte_size: number | bigint | string;
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

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    storage_key:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png',
    content_type: 'image/png',
    byte_size: '12',
    visibility: 'public',
    soft_deleted_at: null,
    ...overrides,
  };
}

function variant(overrides: Partial<Variant> = {}): Variant {
  return {
    object_asset_id: id,
    variant_name: 'sm',
    storage_key:
      'cccccccccccccccccccccccccccccccc/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.webp',
    content_type: 'image/webp',
    byte_size: 8,
    width: 48,
    height: 48,
    visibility: 'public',
    ...overrides,
  };
}

describe('public asset resolution', () => {
  it('allows only responsive variants and builds same-origin content URLs', () => {
    expect(parsePublicAssetVariant(null)).toEqual({ ok: true, value: null });
    expect(parsePublicAssetVariant('sm')).toEqual({ ok: true, value: 'sm' });
    expect(parsePublicAssetVariant('original')).toEqual({ ok: false });
    expect(publicAssetContentUrl(id, 'sm')).toBe(`/api/v1/assets/${id}/content?variant=sm`);
  });

  it('returns safe metadata for completed public objects and variants', async () => {
    const resolved = await resolvePublicAsset(new FakeDb(asset(), variant()) as never, id, 'sm');

    expect(resolved).toMatchObject({
      id,
      storageKey: variant().storage_key,
      contentType: 'image/webp',
      contentLength: 8,
      variant: 'sm',
      width: 48,
      height: 48,
    });
    expect(publicAssetMetadata(resolved!)).toMatchObject({
      id,
      url: `/api/v1/assets/${id}/content?variant=sm`,
      expires_at: null,
      content_type: 'image/webp',
      content_length: 8,
    });
    expect(publicAssetHeaders(resolved!).get('content-type')).toBe('image/webp');
    expect(publicAssetHeaders(resolved!).get('content-length')).toBe('8');
    expect(publicAssetHeaders(resolved!).get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(publicAssetHeaders(resolved!).get('content-disposition')).toBe('inline');
    expect(publicAssetHeaders(resolved!).get('x-content-type-options')).toBe('nosniff');
    expect(
      publicAssetHeaders({ ...resolved!, contentType: 'application/pdf' }).get(
        'content-disposition',
      ),
    ).toBe('attachment');
  });

  it('fails closed for private, soft-deleted, pending, unsafe or oversized records', async () => {
    expect(
      await resolvePublicAsset(new FakeDb(asset({ visibility: 'private' })) as never, id, null),
    ).toBeNull();
    expect(
      await resolvePublicAsset(
        new FakeDb(asset({ soft_deleted_at: new Date() })) as never,
        id,
        null,
      ),
    ).toBeNull();
    expect(
      await resolvePublicAsset(
        new FakeDb(asset({ storage_key: 'pending/upload' })) as never,
        id,
        null,
      ),
    ).toBeNull();
    expect(
      await resolvePublicAsset(new FakeDb(asset({ content_type: 'text/html' })) as never, id, null),
    ).toBeNull();
    expect(
      await resolvePublicAsset(
        new FakeDb(asset({ byte_size: Number.MAX_SAFE_INTEGER + 1 })) as never,
        id,
        null,
      ),
    ).toBeNull();
  });
});
