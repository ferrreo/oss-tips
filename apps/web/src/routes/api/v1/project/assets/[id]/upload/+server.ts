import { BUCKETS, LocalStorageClient } from '@oss-tips/storage';
import { checkProject } from '@oss-tips/auth';
import type { RequestHandler } from './$types';
import { authorizeProject, problem } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  assetUploadSizeLimit,
  getStorage,
  isPendingStorageKey,
  parseUploadContentLength,
  readBoundedUploadBody,
  UploadBodyLengthMismatchError,
  UploadBodyTooLargeError,
} from '$lib/server/storage';

/** Local development fallback for presigned PUTs; production uses RustFS directly. */
export const PUT: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');

  const storage = (() => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  })();
  if (!(storage instanceof LocalStorageClient)) {
    return problem(404, 'Upload endpoint not found');
  }

  const row = await db
    .selectFrom('object_asset')
    .select(['project_id', 'purpose', 'storage_key', 'content_type', 'visibility'])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!row || !isPendingStorageKey(row.storage_key)) return problem(404, 'Upload not found');
  if (
    ['avatar', 'logo', 'banner'].includes(row.purpose) &&
    !checkProject(access.actor, 'project.change_fee_mode', access.projectId).allowed
  ) {
    return problem(403, 'Project access denied', 'Branding assets require project administration');
  }

  let maxBytes: number;
  try {
    maxBytes = assetUploadSizeLimit(row.content_type, row.purpose);
  } catch {
    return problem(422, 'Upload rejected');
  }
  let contentLength: number | undefined;
  try {
    contentLength = parseUploadContentLength(event.request.headers.get('content-length'));
  } catch (error) {
    return problem(
      400,
      'Invalid Content-Length',
      error instanceof Error ? error.message : undefined,
    );
  }
  if (contentLength !== undefined && contentLength > maxBytes) {
    return problem(413, 'Upload is too large');
  }

  let body: Uint8Array;
  try {
    body = await readBoundedUploadBody(event.request, maxBytes, contentLength);
  } catch (error) {
    if (error instanceof UploadBodyTooLargeError) return problem(413, 'Upload is too large');
    if (error instanceof UploadBodyLengthMismatchError) {
      return problem(400, 'Upload length does not match Content-Length');
    }
    return problem(400, 'Upload could not be read');
  }
  if (body.length === 0) return problem(400, 'Upload is empty');
  try {
    await storage.putLocal(BUCKETS.quarantine, row.storage_key, body, row.content_type);
  } catch {
    return problem(422, 'Upload rejected');
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
