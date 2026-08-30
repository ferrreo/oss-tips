import type { Db } from '@oss-tips/db';
import {
  assertSafeContentType,
  assertUploadSize,
  isSafeObjectKey,
  normalizeContentType,
  type AllowedContentType,
} from '@oss-tips/storage';

export const PUBLIC_ASSET_VARIANTS = ['sm', 'md', 'lg'] as const;
export type PublicAssetVariant = (typeof PUBLIC_ASSET_VARIANTS)[number];

export type ParsedPublicAssetVariant =
  { ok: true; value: PublicAssetVariant | null } | { ok: false };

export type PublicAsset = {
  id: string;
  storageKey: string;
  contentType: AllowedContentType;
  contentLength: number;
  variant: PublicAssetVariant | null;
  width?: number;
  height?: number;
};

type AssetRow = {
  id: string;
  storage_key: string;
  content_type: string;
  byte_size: number | bigint | string;
};

type VariantRow = {
  variant_name: PublicAssetVariant;
  storage_key: string;
  content_type: string;
  byte_size: number | bigint | string;
  width: number;
  height: number;
};

export function isPublicAssetId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parsePublicAssetVariant(value: string | null): ParsedPublicAssetVariant {
  if (value === null) return { ok: true, value: null };
  return (PUBLIC_ASSET_VARIANTS as readonly string[]).includes(value)
    ? { ok: true, value: value as PublicAssetVariant }
    : { ok: false };
}

function safeMetadata(
  contentType: string,
  byteSize: number | bigint | string,
): { contentType: AllowedContentType; contentLength: number } | null {
  const contentLength = typeof byteSize === 'number' ? byteSize : Number(byteSize);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1) return null;
  try {
    const normalized = normalizeContentType(contentType);
    assertSafeContentType(normalized);
    assertUploadSize(normalized, contentLength);
    return { contentType: normalized, contentLength };
  } catch {
    return null;
  }
}

function safeStorageKey(value: string): boolean {
  return isSafeObjectKey(value) && !value.startsWith('pending/');
}

function assetFromRow(row: AssetRow): Omit<PublicAsset, 'variant'> | null {
  const metadata = safeMetadata(row.content_type, row.byte_size);
  if (!metadata || !safeStorageKey(row.storage_key)) return null;
  return { id: row.id, storageKey: row.storage_key, ...metadata };
}

/** Resolve only completed public objects; storage keys never come from request input. */
export async function resolvePublicAsset(
  db: Db,
  id: string,
  variant: PublicAssetVariant | null,
): Promise<PublicAsset | null> {
  const row = await db
    .selectFrom('object_asset')
    .select(['id', 'storage_key', 'content_type', 'byte_size'])
    .where('id', '=', id)
    .where('visibility', '=', 'public')
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!row || row.storage_key.startsWith('pending/')) return null;
  const asset = assetFromRow(row);
  if (!asset) return null;
  if (variant === null) return { ...asset, variant: null };

  const variantRow = await db
    .selectFrom('object_asset_variant')
    .select(['variant_name', 'storage_key', 'content_type', 'byte_size', 'width', 'height'])
    .where('object_asset_id', '=', id)
    .where('variant_name', '=', variant)
    .where('visibility', '=', 'public')
    .executeTakeFirst();
  if (!variantRow || !safeStorageKey(variantRow.storage_key)) return null;
  const metadata = safeMetadata(variantRow.content_type, variantRow.byte_size);
  if (
    !metadata ||
    !Number.isSafeInteger(variantRow.width) ||
    !Number.isSafeInteger(variantRow.height) ||
    variantRow.width < 1 ||
    variantRow.height < 1
  ) {
    return null;
  }
  return {
    id: asset.id,
    storageKey: variantRow.storage_key,
    ...metadata,
    variant: variantRow.variant_name,
    width: variantRow.width,
    height: variantRow.height,
  };
}

export function publicAssetContentUrl(id: string, variant: PublicAssetVariant | null): string {
  const query = variant === null ? '' : `?variant=${encodeURIComponent(variant)}`;
  return `/api/v1/assets/${encodeURIComponent(id)}/content${query}`;
}

export function publicAssetMetadata(asset: PublicAsset) {
  return {
    id: asset.id,
    url: publicAssetContentUrl(asset.id, asset.variant),
    expires_at: null,
    content_type: asset.contentType,
    content_length: asset.contentLength,
    ...(asset.variant === null
      ? {}
      : { variant: asset.variant, width: asset.width, height: asset.height }),
  };
}

export function publicAssetHeaders(asset: PublicAsset): Headers {
  return new Headers({
    'content-type': asset.contentType,
    'content-length': String(asset.contentLength),
    'cache-control': 'public, max-age=31536000, immutable',
    'content-disposition': asset.contentType.startsWith('image/') ? 'inline' : 'attachment',
    'x-content-type-options': 'nosniff',
  });
}
