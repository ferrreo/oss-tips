import { checkProject } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import { BUCKETS, LocalStorageClient, newUploadId, quarantineKey } from '@oss-tips/storage';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJsonValue } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getQuarantineFlow, getStorage, parseAssetUploadRequest } from '$lib/server/storage';
import { json } from '$lib/server/http';

async function readBody(request: Request): Promise<unknown | Response> {
  return readJsonValue(request);
}

/** Start every browser upload in RustFS quarantine; final bucket is chosen server-side. */
export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');

  const input = await readBody(event.request);
  if (input instanceof Response) return input;
  const parsed = parseAssetUploadRequest(input);
  if (!parsed.ok) return problem(400, 'Invalid upload metadata', parsed.reason);
  if (
    ['avatar', 'logo', 'banner'].includes(parsed.data.assetKind) &&
    !checkProject(access.actor, 'project.change_fee_mode', access.projectId).allowed
  ) {
    return problem(403, 'Project access denied', 'Branding assets require project administration');
  }

  const storage = (() => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  })();
  if (!storage) return problem(503, 'Storage unavailable', 'Object storage is not configured');

  const key = quarantineKey(newUploadId());
  let upload;
  try {
    upload = await getQuarantineFlow(storage).quarantinePut(key, {
      contentType: parsed.data.contentType,
      contentLength: parsed.data.contentLength,
      filename: parsed.data.filename,
      assetKind: parsed.data.assetKind,
    });
  } catch {
    return problem(422, 'Upload metadata rejected');
  }

  const row = await db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto('object_asset')
      .values({
        id: uuidv7(),
        project_id: access.projectId,
        purpose: parsed.data.purpose,
        visibility: parsed.data.visibility,
        storage_key: key,
        content_type: parsed.data.contentType,
        byte_size: BigInt(parsed.data.contentLength),
        checksum: null,
        soft_deleted_at: null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'asset.upload_requested',
            resourceType: 'object_asset',
            resourceId: created.id,
            projectId: access.projectId,
            metadata: {
              purpose: parsed.data.purpose,
              visibility: parsed.data.visibility,
              content_type: parsed.data.contentType,
              content_length: parsed.data.contentLength,
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
        payload: { project_id: access.projectId, asset_id: created.id, change: 'upload_requested' },
        published_at: null,
      })
      .execute();
    return created;
  });

  return json(
    {
      id: row.id,
      status: 'pending',
      content_type: parsed.data.contentType,
      content_length: parsed.data.contentLength,
      filename: parsed.data.filename,
      bucket: BUCKETS.quarantine,
      upload_url:
        storage instanceof LocalStorageClient
          ? `/api/v1/project/assets/${row.id}/upload`
          : upload.url,
      upload_expires_at: upload.expiresAt,
      complete_url: `/api/v1/project/assets/${row.id}/complete`,
    },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
};
