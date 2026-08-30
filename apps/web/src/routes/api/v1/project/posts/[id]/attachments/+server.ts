import { isPendingStorageKey } from '$lib/server/storage';
import { uuidv7 } from '@oss-tips/domain';
import { lockStorageObjectKeys } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJsonValue } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

type AttachmentInput = { asset_id: string; sort_order?: number };

function attachmentDownloadUrl(assetId: string): string {
  return `/api/v1/assets/${encodeURIComponent(assetId)}/download?redirect=1`;
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:read');
  if (access instanceof Response) return access;
  const post = await db
    .selectFrom('post')
    .select('id')
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!post) return problem(404, 'Post not found');
  const revision = await db
    .selectFrom('post_revision')
    .select('id')
    .where('post_id', '=', post.id)
    .orderBy('revision_number', 'desc')
    .executeTakeFirst();
  if (!revision) return json([], { headers: { 'cache-control': 'private, no-store' } });
  const rows = await db
    .selectFrom('post_attachment')
    .innerJoin('post_revision', 'post_revision.id', 'post_attachment.post_revision_id')
    .innerJoin('object_asset', 'object_asset.id', 'post_attachment.object_asset_id')
    .select([
      'post_attachment.id',
      'post_attachment.post_revision_id',
      'post_attachment.object_asset_id',
      'post_attachment.sort_order',
      'object_asset.content_type',
      'object_asset.byte_size',
      'object_asset.visibility',
      'object_asset.storage_key',
      'object_asset.soft_deleted_at',
    ])
    .where('post_attachment.post_revision_id', '=', revision.id)
    .where('post_revision.post_id', '=', post.id)
    .where('object_asset.project_id', '=', access.projectId)
    .where('object_asset.soft_deleted_at', 'is', null)
    .orderBy('post_attachment.sort_order', 'asc')
    .execute();
  return json(rows.map(attachmentPayload), { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const input = await readAttachmentInput(event.request);
  if (input instanceof Response) return input;

  const post = await db
    .selectFrom('post')
    .select('id')
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!post) return problem(404, 'Post not found');
  const revision = await db
    .selectFrom('post_revision')
    .select(['id', 'revision_number'])
    .where('post_id', '=', post.id)
    .orderBy('revision_number', 'desc')
    .executeTakeFirst();
  if (!revision) return problem(409, 'Post has no revision');
  const asset = await db
    .selectFrom('object_asset')
    .select([
      'id',
      'project_id',
      'purpose',
      'visibility',
      'storage_key',
      'content_type',
      'byte_size',
      'soft_deleted_at',
    ])
    .where('id', '=', input.asset_id)
    .where('project_id', '=', access.projectId)
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!asset) return problem(404, 'Attachment asset not found');
  if (asset.purpose !== 'attachment' && asset.purpose !== 'post_image')
    return problem(400, 'Asset is not a post attachment');
  if (asset.visibility !== 'private' || isPendingStorageKey(asset.storage_key))
    return problem(409, 'Attachment must be a completed private asset');
  const existing = await db
    .selectFrom('post_attachment')
    .select(['id'])
    .where('post_revision_id', '=', revision.id)
    .where('object_asset_id', '=', asset.id)
    .executeTakeFirst();
  if (existing)
    return json(
      {
        id: existing.id,
        post_revision_id: revision.id,
        object_asset_id: asset.id,
        sort_order: input.sort_order,
      },
      { status: 200 },
    );
  let row;
  try {
    row = await db.transaction().execute(async (trx) => {
      await lockStorageObjectKeys(trx, [asset.storage_key]);
      const lockedAsset = await trx
        .selectFrom('object_asset')
        .select([
          'id',
          'project_id',
          'purpose',
          'visibility',
          'storage_key',
          'content_type',
          'byte_size',
          'soft_deleted_at',
        ])
        .where('id', '=', asset.id)
        .where('project_id', '=', access.projectId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !lockedAsset ||
        lockedAsset.soft_deleted_at ||
        lockedAsset.storage_key !== asset.storage_key
      ) {
        throw new AttachmentAssetUnavailableError();
      }
      const created = await trx
        .insertInto('post_attachment')
        .values({
          id: uuidv7(),
          post_revision_id: revision.id,
          object_asset_id: asset.id,
          sort_order: input.sort_order ?? 0,
        })
        .returning(['id', 'post_revision_id', 'object_asset_id', 'sort_order'])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'post.attachment_added',
              resourceType: 'post_attachment',
              resourceId: created.id,
              projectId: access.projectId,
              metadata: { post_id: post.id, asset_id: asset.id },
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
          payload: {
            project_id: access.projectId,
            post_id: post.id,
            asset_id: asset.id,
            change: 'attachment_added',
          },
          published_at: null,
        })
        .execute();
      return { created, asset: lockedAsset };
    });
  } catch (error) {
    if (error instanceof AttachmentAssetUnavailableError) {
      return problem(409, 'Attachment asset changed', 'Choose a completed, active asset');
    }
    throw error;
  }
  return json(
    {
      ...row.created,
      content_type: row.asset.content_type,
      content_length: Number(row.asset.byte_size),
      visibility: row.asset.visibility,
      download_url: attachmentDownloadUrl(row.asset.id),
    },
    { status: 201, headers: { 'cache-control': 'private, no-store' } },
  );
};

async function readAttachmentInput(request: Request): Promise<AttachmentInput | Response> {
  const body = await readJsonValue(request);
  if (body instanceof Response) return body;
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return problem(400, 'Invalid request', 'Request body must be an object');
  const value = body as Record<string, unknown>;
  if (typeof value.asset_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.asset_id))
    return problem(400, 'Invalid request', 'asset_id must be a UUID');
  if (
    value.sort_order !== undefined &&
    (!Number.isSafeInteger(value.sort_order) ||
      (value.sort_order as number) < 0 ||
      (value.sort_order as number) > 1000)
  )
    return problem(400, 'Invalid request', 'sort_order must be between 0 and 1000');
  if (Object.keys(value).some((key) => key !== 'asset_id' && key !== 'sort_order'))
    return problem(400, 'Invalid request', 'Unknown attachment field');
  return { asset_id: value.asset_id, sort_order: value.sort_order as number | undefined };
}

class AttachmentAssetUnavailableError extends Error {}

function attachmentPayload(row: {
  id: string;
  post_revision_id: string;
  object_asset_id: string;
  sort_order: number;
  content_type: string;
  byte_size: number | bigint;
  visibility: string;
  storage_key: string;
  soft_deleted_at: Date | null;
}) {
  return {
    id: row.id,
    post_revision_id: row.post_revision_id,
    object_asset_id: row.object_asset_id,
    sort_order: row.sort_order,
    content_type: row.content_type,
    content_length: Number(row.byte_size),
    visibility: row.visibility,
    status: isPendingStorageKey(row.storage_key) ? 'pending' : 'ready',
    download_url: attachmentDownloadUrl(row.object_asset_id),
  };
}
