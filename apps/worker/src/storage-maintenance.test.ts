import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@oss-tips/db';
import {
  BUCKETS,
  createQuarantineFlow,
  LocalStorageClient,
  newUploadId,
  quarantineKey,
  type BucketName,
  type StorageObjectInfo,
} from '@oss-tips/storage';
import {
  cleanupOrphanedPromotedObjects,
  cleanupStaleQuarantineObjects,
  cleanupExpiredExports,
  inventoryStorage,
  purgeDeletedMedia,
  type StorageMaintenanceDependencies,
} from './storage-maintenance.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

type Asset = {
  id: string;
  purpose: string;
  visibility: string;
  storage_key: string;
  byte_size: bigint;
  expires_at: Date | null;
  soft_deleted_at: Date | null;
  legal_hold: boolean;
  created_at: Date;
  reserved_bytes?: bigint;
  updated_at?: Date;
};

type Variant = {
  id: string;
  object_asset_id: string;
  storage_key: string;
  visibility: string;
  byte_size: bigint;
};

type Attachment = { object_asset_id: string };

function fakeDb(input: {
  assets?: Asset[];
  variants?: Variant[];
  attachments?: Attachment[];
  onExecuteQuery?: (query: { sql: string }) => void;
}): {
  db: Db;
  assets: Asset[];
  variants: Variant[];
} {
  const assets = [...(input.assets ?? [])];
  const variants = [...(input.variants ?? [])];
  const attachments = [...(input.attachments ?? [])];
  const rowsFor = (table: string): Array<Record<string, unknown>> => {
    if (table === 'object_asset') return assets;
    if (table === 'object_asset_variant') return variants;
    return attachments;
  };
  const matches = (row: Record<string, unknown>, conditions: Array<[string, string, unknown]>) =>
    conditions.every(([field, operator, expected]) => {
      const actual = row[field];
      if (operator === '=') return actual === expected;
      if (operator === '!=') return actual !== expected;
      if (operator === 'is') return actual === expected;
      if (operator === 'like')
        return (
          typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.startsWith(expected.replace(/%$/, ''))
        );
      if (operator === '<=')
        return actual instanceof Date && actual.getTime() <= (expected as Date).getTime();
      return true;
    });
  const selectFrom = (table: string) => {
    const conditions: Array<[string, string, unknown]> = [];
    const query = {
      select: vi.fn(() => query),
      forUpdate: vi.fn(() => query),
      where: vi.fn((field: string, operator: string, value: unknown) => {
        conditions.push([field, operator, value]);
        return query;
      }),
      execute: vi.fn(async () => rowsFor(table).filter((row) => matches(row, conditions))),
      executeTakeFirst: vi.fn(async () => rowsFor(table).find((row) => matches(row, conditions))),
    };
    return query;
  };
  const deleteFrom = (table: string) => {
    const conditions: Array<[string, string, unknown]> = [];
    const query = {
      where: vi.fn((field: string, operator: string, value: unknown) => {
        conditions.push([field, operator, value]);
        return query;
      }),
      execute: vi.fn(async () => {
        const rows = rowsFor(table);
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (matches(rows[index]!, conditions)) rows.splice(index, 1);
        }
        return [];
      }),
    };
    return query;
  };
  const updateTable = (table: string) => {
    const conditions: Array<[string, string, unknown]> = [];
    let changes: Record<string, unknown> = {};
    const query = {
      set: vi.fn((value: Record<string, unknown>) => {
        changes = value;
        return query;
      }),
      where: vi.fn((field: string, operator: string, value: unknown) => {
        conditions.push([field, operator, value]);
        return query;
      }),
      execute: vi.fn(async () => {
        const rows = rowsFor(table);
        let updated = 0;
        for (const row of rows) {
          if (!matches(row, conditions)) continue;
          Object.assign(row, changes);
          updated += 1;
        }
        return { numUpdatedRows: BigInt(updated) };
      }),
    };
    return query;
  };
  const executor = {
    transformQuery: (node: unknown) => node,
    compileQuery: () => ({ sql: '', parameters: [] }),
    executeQuery: async () => {
      input.onExecuteQuery?.({ sql: '' });
      return { rows: [] };
    },
    withPlugins: () => executor,
  };
  const db = {
    selectFrom,
    deleteFrom,
    updateTable,
    getExecutor: () => executor,
    transaction: () => ({
      execute: async <T>(callback: (trx: typeof db) => Promise<T>): Promise<T> => callback(db),
    }),
  };
  return { db: db as unknown as Db, assets, variants };
}

function dependencies(
  db: Db,
  objects: Partial<Record<BucketName, StorageObjectInfo[]>> = {},
  now = new Date('2026-02-01T00:00:00.000Z'),
): StorageMaintenanceDependencies & {
  deleted: Array<{ bucket: BucketName; key: string }>;
} {
  const deleted: Array<{ bucket: BucketName; key: string }> = [];
  return {
    db,
    storage: {
      listObjects: vi.fn(async (bucket: BucketName) => objects[bucket] ?? []),
      deleteObject: vi.fn(async (bucket, key) => {
        deleted.push({ bucket, key });
      }),
    },
    now: () => now,
    deleted,
  };
}

const media = (id: string, overrides: Partial<Asset> = {}): Asset => ({
  id,
  purpose: 'post_image',
  visibility: 'public',
  storage_key: `media/${id}.png`,
  byte_size: 3n,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  expires_at: null,
  soft_deleted_at: null,
  legal_hold: false,
  ...overrides,
});

describe('storage inventory', () => {
  it('compares persisted asset references with listed object keys and sizes', async () => {
    const { db } = fakeDb({
      assets: [
        media('public', { storage_key: 'media/public.png' }),
        media('private', {
          visibility: 'private',
          storage_key: 'media/private.bin',
          byte_size: 5n,
        }),
      ],
      variants: [
        {
          id: 'variant',
          object_asset_id: 'private',
          storage_key: 'media/private.webp',
          visibility: 'private',
          byte_size: 2n,
        },
      ],
    });
    const report = await inventoryStorage(
      db,
      dependencies(db, {
        [BUCKETS.publicMedia]: [
          { key: 'media/public.png', contentLength: 4 },
          { key: 'media/orphan.png' },
        ],
        [BUCKETS.privateContent]: [],
      }).storage,
    );

    expect(report).toEqual({
      referencesChecked: 3,
      objectsChecked: 2,
      missingReferences: 2,
      orphanObjects: 1,
      sizeMismatches: 1,
      invalidReferences: 0,
    });
  });
});

describe('storage retention', () => {
  it('clears stale pending metadata and quarantine bytes while retaining recent uploads', async () => {
    const staleKey = quarantineKey('stale');
    const recentKey = quarantineKey('recent');
    const orphanKey = quarantineKey('orphan');
    const { db, assets } = fakeDb({
      assets: [
        media('stale', { storage_key: staleKey }),
        media('recent', {
          storage_key: recentKey,
          created_at: new Date('2026-01-31T12:00:00.000Z'),
        }),
      ],
    });
    const deps = dependencies(db, {
      [BUCKETS.quarantine]: [
        { key: staleKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
        { key: recentKey, lastModified: new Date('2026-01-31T12:00:00.000Z') },
        { key: orphanKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
      ],
    });

    await expect(cleanupStaleQuarantineObjects(deps)).resolves.toBe(2);
    expect(deps.deleted).toEqual([
      { bucket: BUCKETS.quarantine, key: staleKey },
      { bucket: BUCKETS.quarantine, key: orphanKey },
    ]);
    expect(assets.find(({ id }) => id === 'stale')).toMatchObject({
      soft_deleted_at: new Date('2026-02-01T00:00:00.000Z'),
      reserved_bytes: 0n,
    });
    expect(assets.find(({ id }) => id === 'recent')?.soft_deleted_at).toBeNull();
  });

  it('clears stale pending metadata even when quarantine bytes are already missing', async () => {
    const pendingKey = quarantineKey('missing');
    const { db, assets } = fakeDb({ assets: [media('missing', { storage_key: pendingKey })] });

    await expect(
      cleanupStaleQuarantineObjects(dependencies(db, { [BUCKETS.quarantine]: [] })),
    ).resolves.toBe(1);
    expect(assets[0]).toMatchObject({
      soft_deleted_at: new Date('2026-02-01T00:00:00.000Z'),
      reserved_bytes: 0n,
    });
  });

  it('retains pending rows when their current quarantine object is recent', async () => {
    const pendingKey = quarantineKey('in-flight');
    const { db, assets } = fakeDb({
      assets: [media('in-flight', { storage_key: pendingKey })],
    });
    const deps = dependencies(db, {
      [BUCKETS.quarantine]: [
        { key: pendingKey, lastModified: new Date('2026-01-31T12:00:00.000Z') },
      ],
    });

    await expect(cleanupStaleQuarantineObjects(deps)).resolves.toBe(0);
    expect(deps.deleted).toEqual([]);
    expect(assets[0]?.soft_deleted_at).toBeNull();
  });

  it('reclaims a promoted object after metadata and audit transaction rollback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-maintenance-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const flow = createQuarantineFlow(storage, {
      scanner: { scan: async () => ({ clean: true as const }) },
    });
    const body = new TextEncoder().encode('release notes');
    const pendingKey = quarantineKey(newUploadId());
    const { db } = fakeDb({
      assets: [
        media('upload', {
          purpose: 'attachment',
          visibility: 'private',
          storage_key: pendingKey,
          byte_size: BigInt(body.length),
        }),
      ],
    });

    let targetKey: string | undefined;
    await expect(
      db.transaction().execute(async () => {
        targetKey = (
          await flow.validateAndPromote(pendingKey, BUCKETS.privateContent, body, undefined, {
            contentType: 'text/plain',
            contentLength: body.length,
            assetKind: 'attachment',
          })
        ).targetKey;
        throw new Error('audit insert rolled back');
      }),
    ).rejects.toThrow('audit insert rolled back');
    expect(targetKey).toBeDefined();

    const old = new Date('2026-01-01T00:00:00.000Z');
    await utimes(join(root, BUCKETS.privateContent, targetKey!), old, old);
    await expect(
      cleanupOrphanedPromotedObjects({
        db,
        storage,
        now: () => new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).resolves.toBe(1);
    await expect(storage.listObjects(BUCKETS.privateContent)).resolves.toEqual([]);
  });

  it('retains recent, referenced, and in-flight promoted objects', async () => {
    const referencedKey = `${'a'.repeat(32)}/${'b'.repeat(64)}.png`;
    const inFlightKey = `${'c'.repeat(32)}/${'d'.repeat(64)}.png`;
    const recentKey = `${'e'.repeat(32)}/${'f'.repeat(64)}.png`;
    const noTimestampKey = `${'1'.repeat(32)}/${'2'.repeat(64)}.png`;
    const { db, assets } = fakeDb({
      assets: [
        media('referenced', { storage_key: referencedKey }),
        media('in-flight', { storage_key: quarantineKey('upload') }),
      ],
      onExecuteQuery: () => {
        const upload = assets.find(({ id }) => id === 'in-flight');
        if (upload) upload.storage_key = inFlightKey;
      },
    });
    const deps = dependencies(db, {
      [BUCKETS.publicMedia]: [
        { key: referencedKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
        { key: inFlightKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
        { key: recentKey, lastModified: new Date('2026-01-31T12:00:00.000Z') },
        { key: noTimestampKey },
      ],
    });

    await expect(cleanupOrphanedPromotedObjects(deps)).resolves.toBe(0);
    expect(deps.deleted).toEqual([]);
  });

  it('reclaims old unreferenced exports while retaining recent and referenced exports', async () => {
    const orphanKey = 'exports/project/orphan.json';
    const referencedKey = 'exports/project/referenced.json';
    const recentKey = 'exports/project/recent.json';
    const { db } = fakeDb({
      assets: [
        media('referenced-export', {
          purpose: 'export',
          visibility: 'private',
          storage_key: referencedKey,
        }),
      ],
    });
    const deps = dependencies(db, {
      [BUCKETS.exports]: [
        { key: orphanKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
        { key: referencedKey, lastModified: new Date('2026-01-01T00:00:00.000Z') },
        { key: recentKey, lastModified: new Date('2026-01-31T12:00:00.000Z') },
        { key: 'exports/project/manual.txt', lastModified: new Date('2026-01-01T00:00:00.000Z') },
      ],
    });

    await expect(cleanupOrphanedPromotedObjects(deps)).resolves.toBe(1);
    expect(deps.deleted).toEqual([{ bucket: BUCKETS.exports, key: orphanKey }]);
  });

  it('reclaims an export written before metadata transaction rollback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-maintenance-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const exportKey = 'exports/project/rollback.json';
    await storage.putExport(exportKey, new TextEncoder().encode('{"ok":true}\n'), {
      contentType: 'application/json',
      expiresAt: new Date('2026-02-02T00:00:00.000Z'),
    });
    const { db } = fakeDb({});
    await expect(
      db.transaction().execute(async () => {
        throw new Error('export metadata transaction rolled back');
      }),
    ).rejects.toThrow('export metadata transaction rolled back');
    const old = new Date('2026-01-01T00:00:00.000Z');
    await utimes(join(root, BUCKETS.exports, exportKey), old, old);

    await expect(
      cleanupOrphanedPromotedObjects({
        db,
        storage,
        now: () => new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).resolves.toBe(1);
    await expect(storage.listObjects(BUCKETS.exports)).resolves.toEqual([]);
  });

  it('reclaims old unreferenced promoted objects after a failed metadata commit', async () => {
    const oldKey = `${'a'.repeat(32)}/${'b'.repeat(64)}.png`;
    const referencedKey = `${'c'.repeat(32)}/${'d'.repeat(64)}.png`;
    const recentKey = `${'e'.repeat(32)}/${'f'.repeat(64)}.png`;
    const { db } = fakeDb({
      assets: [media('referenced', { storage_key: referencedKey })],
    });
    const deps = dependencies(db, {
      [BUCKETS.publicMedia]: [
        {
          key: oldKey,
          lastModified: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          key: referencedKey,
          lastModified: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          key: recentKey,
          lastModified: new Date('2026-01-31T12:00:00.000Z'),
        },
        { key: `${'1'.repeat(32)}/${'2'.repeat(64)}.png` },
        { key: 'manual/orphan.png', lastModified: new Date('2026-01-01T00:00:00.000Z') },
      ],
    });

    await expect(cleanupOrphanedPromotedObjects(deps)).resolves.toBe(1);
    expect(deps.deleted).toEqual([{ bucket: BUCKETS.publicMedia, key: oldKey }]);
  });

  it('deletes expired exports before removing their metadata', async () => {
    const { db, assets } = fakeDb({
      assets: [
        media('expired', {
          purpose: 'export',
          visibility: 'private',
          storage_key: 'exports/project/job.json',
          expires_at: new Date('2026-01-31T23:59:59.000Z'),
        }),
        media('active', {
          purpose: 'export',
          visibility: 'private',
          storage_key: 'exports/project/active.json',
          expires_at: new Date('2026-02-02T00:00:00.000Z'),
        }),
      ],
    });
    const deps = dependencies(db);

    await expect(cleanupExpiredExports(deps)).resolves.toBe(1);
    expect(deps.deleted).toEqual([{ bucket: BUCKETS.exports, key: 'exports/project/job.json' }]);
    expect(assets.map(({ id }) => id)).toEqual(['active']);
  });

  it('purges old unreferenced media and keeps recent, shared, or attached assets', async () => {
    const { db, assets } = fakeDb({
      assets: [
        media('old', { soft_deleted_at: new Date('2026-01-01') }),
        media('shared', {
          storage_key: 'media/shared.png',
          soft_deleted_at: new Date('2026-01-01'),
        }),
        media('shared-live', { storage_key: 'media/shared.png' }),
        media('attached', {
          storage_key: 'media/attached.png',
          soft_deleted_at: new Date('2026-01-01'),
        }),
        media('recent', {
          storage_key: 'media/recent.png',
          soft_deleted_at: new Date('2026-01-20'),
        }),
        media('with-variant', {
          storage_key: 'media/with-variant.png',
          soft_deleted_at: new Date('2026-01-01'),
        }),
      ],
      variants: [
        {
          id: 'variant',
          object_asset_id: 'with-variant',
          storage_key: 'media/with-variant.webp',
          visibility: 'public',
          byte_size: 2n,
        },
      ],
      attachments: [{ object_asset_id: 'attached' }],
    });
    const deps = dependencies(db);

    await expect(purgeDeletedMedia(deps)).resolves.toBe(3);
    expect(deps.deleted).toEqual([
      { bucket: BUCKETS.publicMedia, key: 'media/old.png' },
      { bucket: BUCKETS.publicMedia, key: 'media/with-variant.png' },
      { bucket: BUCKETS.publicMedia, key: 'media/with-variant.webp' },
    ]);
    expect(assets.map(({ id }) => id)).toEqual(['shared-live', 'attached', 'recent']);
  });

  it('deletes a shared object after its final deleted reference is purged', async () => {
    const { db, assets } = fakeDb({
      assets: [
        media('first', {
          storage_key: 'media/shared-deleted.png',
          soft_deleted_at: new Date('2026-01-01'),
        }),
        media('second', {
          storage_key: 'media/shared-deleted.png',
          soft_deleted_at: new Date('2026-01-01'),
        }),
      ],
    });
    const deps = dependencies(db);

    await expect(purgeDeletedMedia(deps)).resolves.toBe(2);
    expect(deps.deleted).toEqual([
      { bucket: BUCKETS.publicMedia, key: 'media/shared-deleted.png' },
    ]);
    expect(assets).toEqual([]);
  });

  it('keeps deleted media under legal hold', async () => {
    const { db, assets } = fakeDb({
      assets: [
        media('held', {
          soft_deleted_at: new Date('2026-01-01'),
          legal_hold: true,
        }),
      ],
    });
    const deps = dependencies(db);

    await expect(purgeDeletedMedia(deps)).resolves.toBe(0);
    expect(deps.deleted).toEqual([]);
    expect(assets.map(({ id }) => id)).toEqual(['held']);
  });

  it('does not delete a content-addressed object adopted by an upload while purging', async () => {
    const sharedKey = 'media/shared-content.png';
    const { db, assets } = fakeDb({
      assets: [
        media('deleted', {
          storage_key: sharedKey,
          soft_deleted_at: new Date('2026-01-01'),
        }),
        media('upload', { storage_key: 'pending/upload' }),
      ],
      onExecuteQuery: () => {
        const upload = assets.find(({ id }) => id === 'upload');
        if (upload) upload.storage_key = sharedKey;
      },
    });
    const deps = dependencies(db);

    await expect(purgeDeletedMedia(deps)).resolves.toBe(1);
    expect(deps.deleted).toEqual([]);
    expect(assets.map(({ id, storage_key }) => ({ id, storage_key }))).toEqual([
      { id: 'upload', storage_key: sharedKey },
    ]);
  });
});
