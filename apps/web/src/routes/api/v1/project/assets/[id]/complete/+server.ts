import { checkProject } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import { lockStorageObjectKeys } from '@oss-tips/db';
import { MalwareDetectedError, MalwareScannerUnavailableError } from '@oss-tips/storage';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  getQuarantineFlow,
  getStorage,
  isAssetKind,
  isPendingStorageKey,
  StorageQuotaExceededError,
  readQuarantineObject,
  reserveProjectStorageQuotaInTransaction,
  targetBucketForVisibility,
} from '$lib/server/storage';
import { json } from '$lib/server/http';

function assetPayload(
  row: {
    id: string;
    storage_key: string;
    content_type: string;
    byte_size: number | bigint;
    visibility: string;
  },
  variants: Array<{
    variant_name: string;
    storage_key: string;
    content_type: string;
    byte_size: number | bigint;
    width: number;
    height: number;
    visibility: string;
  }> = [],
) {
  const downloadUrl = `/api/v1/assets/${encodeURIComponent(row.id)}/download?redirect=1`;
  return {
    id: row.id,
    status: isPendingStorageKey(row.storage_key) ? 'pending' : 'ready',
    storage_key: row.storage_key,
    content_type: row.content_type,
    content_length: Number(row.byte_size),
    visibility: row.visibility,
    ...(row.visibility === 'private' ? { download_url: downloadUrl } : {}),
    variants: variants.map((variant) => ({
      name: variant.variant_name,
      storage_key: variant.storage_key,
      content_type: variant.content_type,
      content_length: Number(variant.byte_size),
      width: variant.width,
      height: variant.height,
      visibility: variant.visibility,
      ...(variant.visibility === 'private'
        ? {
            download_url: `${downloadUrl}&variant=${encodeURIComponent(variant.variant_name)}`,
          }
        : {}),
    })),
  };
}

/** Validate uploaded bytes server-side, then atomically publish their content-addressed key. */
export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');

  const row = await db
    .selectFrom('object_asset')
    .select([
      'id',
      'project_id',
      'purpose',
      'visibility',
      'storage_key',
      'content_type',
      'byte_size',
    ])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!row) return problem(404, 'Upload not found');
  if (
    ['avatar', 'logo', 'banner'].includes(row.purpose) &&
    !checkProject(access.actor, 'project.change_fee_mode', access.projectId).allowed
  ) {
    return problem(403, 'Project access denied', 'Branding assets require project administration');
  }
  if (!isPendingStorageKey(row.storage_key)) {
    const variants = await db
      .selectFrom('object_asset_variant')
      .select([
        'variant_name',
        'storage_key',
        'content_type',
        'byte_size',
        'width',
        'height',
        'visibility',
      ])
      .where('object_asset_id', '=', row.id)
      .orderBy('variant_name', 'asc')
      .execute();
    return json(assetPayload(row, variants));
  }
  if (row.visibility !== 'public' && row.visibility !== 'private') {
    return problem(409, 'Upload has invalid visibility');
  }

  let storage: ReturnType<typeof getStorage>;
  try {
    storage = getStorage();
  } catch {
    return problem(503, 'Storage unavailable', 'Object storage is not configured');
  }

  let body: Uint8Array;
  try {
    body = await readQuarantineObject(storage, row.storage_key);
  } catch {
    return problem(409, 'Upload is not ready', 'Upload bytes are missing');
  }

  const completed = await db.transaction().execute(async (trx) => {
    let promoted: Awaited<ReturnType<ReturnType<typeof getQuarantineFlow>['validateAndPromote']>>;
    try {
      promoted = await getQuarantineFlow(storage).validateAndPromote(
        row.storage_key,
        targetBucketForVisibility(row.visibility as 'public' | 'private'),
        body,
        undefined,
        {
          contentType: row.content_type,
          contentLength: Number(row.byte_size),
          ...(isAssetKind(row.purpose) ? { assetKind: row.purpose } : {}),
          beforePromote: async (prepared) => {
            await lockStorageObjectKeys(trx, [
              row.storage_key,
              prepared.targetKey,
              ...prepared.variants.map((variant) => variant.targetKey),
            ]);
            const current = await trx
              .selectFrom('object_asset')
              .select(['storage_key', 'soft_deleted_at'])
              .where('id', '=', row.id)
              .where('project_id', '=', access.projectId)
              .forUpdate()
              .executeTakeFirst();
            if (!current || current.storage_key !== row.storage_key || current.soft_deleted_at) {
              throw new Error('Upload changed during completion');
            }
            await reserveProjectStorageQuotaInTransaction(trx, access.projectId, row.id, prepared);
          },
        },
      );
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        return problem(413, 'Project storage quota exceeded');
      }
      if (error instanceof MalwareScannerUnavailableError) {
        return problem(503, 'Upload scanner unavailable', 'Please try again later');
      }
      if (error instanceof MalwareDetectedError) {
        return problem(422, 'Upload rejected', 'Upload failed security checks');
      }
      return problem(422, 'Upload could not be verified', 'Upload bytes are invalid');
    }
    const checksum = /^\w+\/([a-f0-9]{64})\.[a-z0-9]+$/.exec(promoted.targetKey)?.[1] ?? null;
    const updated = await trx
      .updateTable('object_asset')
      .set({
        storage_key: promoted.targetKey,
        content_type: promoted.contentType,
        byte_size: BigInt(promoted.contentLength),
        reserved_bytes: 0n,
        checksum,
        updated_at: new Date(),
      })
      .where('id', '=', row.id)
      .where('project_id', '=', access.projectId)
      .returning(['id', 'storage_key', 'content_type', 'byte_size', 'visibility'])
      .executeTakeFirstOrThrow();
    if (promoted.variants.length > 0) {
      await trx
        .insertInto('object_asset_variant')
        .values(
          promoted.variants.map((variant) => ({
            id: uuidv7(),
            object_asset_id: row.id,
            project_id: access.projectId,
            variant_name: variant.name as 'sm' | 'md' | 'lg',
            visibility: row.visibility as 'public' | 'private',
            storage_key: variant.targetKey,
            content_type: variant.contentType,
            byte_size: BigInt(variant.contentLength),
            width: variant.width,
            height: variant.height,
            checksum:
              /^\w+\/([a-f0-9]{64})\.[a-z0-9]+$/.exec(variant.targetKey)?.[1] ?? variant.targetKey,
          })),
        )
        .execute();
    }
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'asset.upload_completed',
            resourceType: 'object_asset',
            resourceId: updated.id,
            projectId: access.projectId,
            metadata: {
              content_type: updated.content_type,
              content_length: Number(updated.byte_size),
            },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: { project_id: access.projectId, asset_id: updated.id, change: 'asset_ready' },
        published_at: null,
      })
      .execute();
    return updated;
  });
  if (completed instanceof Response) return completed;

  const variants = await db
    .selectFrom('object_asset_variant')
    .select([
      'variant_name',
      'storage_key',
      'content_type',
      'byte_size',
      'width',
      'height',
      'visibility',
    ])
    .where('object_asset_id', '=', completed.id)
    .orderBy('variant_name', 'asc')
    .execute();
  return json(assetPayload(completed, variants), {
    headers: { 'cache-control': 'private, no-store' },
  });
};
