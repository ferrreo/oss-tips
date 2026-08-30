import { describe, expect, it, vi } from 'vitest';
import { BUCKETS } from '@oss-tips/storage';
import type { Db } from '@oss-tips/db';
import {
  isPendingStorageKey,
  parseAssetUploadRequest,
  softDeleteAssetIfUnreferenced,
  targetBucketForVisibility,
} from './storage';

function softDeleteDb(input: {
  legalHold?: boolean;
  attachment?: boolean;
  projectReference?: boolean;
}) {
  const state = {
    softDeletedAt: null as Date | null,
    legalHold: input.legalHold ?? false,
  };
  const executeQuery = vi.fn(async () => ({ rows: [] }));
  const executor = {
    transformQuery: (node: unknown) => node,
    compileQuery: () => ({ sql: '', parameters: [] }),
    executeQuery,
    withPlugins: () => executor,
  };
  const objectAsset = {
    select: vi.fn(() => objectAsset),
    where: vi.fn(() => objectAsset),
    forUpdate: vi.fn(() => objectAsset),
    executeTakeFirst: vi.fn(async () => ({
      id: 'asset-1',
      storage_key: 'media/asset-1.png',
      soft_deleted_at: state.softDeletedAt,
      legal_hold: state.legalHold,
    })),
  };
  const attachment = {
    select: vi.fn(() => attachment),
    where: vi.fn(() => attachment),
    executeTakeFirst: vi.fn(async () => (input.attachment ? { id: 'attachment-1' } : undefined)),
  };
  const project = {
    select: vi.fn(() => project),
    where: vi.fn(() => project),
    executeTakeFirst: vi.fn(async () => (input.projectReference ? { id: 'project-1' } : undefined)),
  };
  const update = {
    set: vi.fn(() => update),
    where: vi.fn(() => update),
    executeTakeFirst: vi.fn(async () => {
      state.softDeletedAt = new Date('2026-08-30T12:00:00.000Z');
      return { numUpdatedRows: 1n };
    }),
  };
  const db = {
    getExecutor: () => executor,
    selectFrom: vi.fn((table: string) => {
      if (table === 'object_asset') return objectAsset;
      if (table === 'post_attachment') return attachment;
      return project;
    }),
    updateTable: vi.fn(() => update),
  } as unknown as Db;
  return { db, executeQuery, state };
}

describe('web storage upload boundary', () => {
  it('defaults attachments to private quarantine uploads and keeps filename metadata safe', () => {
    const result = parseAssetUploadRequest({
      asset_kind: 'attachment',
      content_type: 'application/pdf',
      content_length: 1024,
      filename: '../../release\u0000.pdf',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        assetKind: 'attachment',
        contentType: 'application/pdf',
        contentLength: 1024,
        filename: '.._.._release.pdf',
        purpose: 'attachment',
        visibility: 'private',
      },
    });
    expect(targetBucketForVisibility('private')).toBe(BUCKETS.privateContent);
  });

  it('rejects unsafe combinations before storage is touched', () => {
    expect(
      parseAssetUploadRequest({
        asset_kind: 'logo',
        content_type: 'image/svg+xml',
        content_length: 42,
        visibility: 'private',
      }),
    ).toEqual({ ok: false, reason: 'content_type is not allowed' });
    expect(
      parseAssetUploadRequest({
        asset_kind: 'attachment',
        content_type: 'application/pdf',
        content_length: 42,
        visibility: 'public',
      }),
    ).toEqual({ ok: false, reason: 'attachments must be private' });
  });

  it('recognises only safe pending object keys', () => {
    expect(isPendingStorageKey('pending/upload_01')).toBe(true);
    expect(isPendingStorageKey('pending/upload_01/extra')).toBe(false);
    expect(isPendingStorageKey('private/hash.pdf')).toBe(false);
  });

  it('soft-deletes an unreferenced asset under its object-key lock', async () => {
    const { db, executeQuery, state } = softDeleteDb({});

    await expect(
      softDeleteAssetIfUnreferenced(db, 'asset-1', new Date('2026-08-30T12:00:00.000Z')),
    ).resolves.toBe(true);
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(state.softDeletedAt).toEqual(new Date('2026-08-30T12:00:00.000Z'));
  });

  it('does not soft-delete held or still-referenced assets', async () => {
    for (const input of [{ legalHold: true }, { attachment: true }, { projectReference: true }]) {
      const { db, state } = softDeleteDb(input);
      await expect(softDeleteAssetIfUnreferenced(db, 'asset-1')).resolves.toBe(false);
      expect(state.softDeletedAt).toBeNull();
    }
  });
});
