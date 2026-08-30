import { BUCKETS, assertExportKey, normalizeContentType } from '@oss-tips/storage';
import type { RequestHandler } from './$types';
import { authorizeProject, problem } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function payloadValue(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/** Stream a completed export only after project capability and expiry checks. */
export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!SAFE_ID.test(event.params.id)) return problem(404, 'Export not found');

  const db = getDb();
  const access = await authorizeProject(event, db, 'project.export_finance', 'analytics:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');

  const job = await db
    .selectFrom('job')
    .select(['id', 'status', 'payload'])
    .where('id', '=', event.params.id)
    .where('queue', '=', 'exports')
    .executeTakeFirst();
  if (
    !job ||
    payloadValue(job.payload, 'project_id') !== access.projectId ||
    job.status !== 'completed'
  ) {
    return problem(404, 'Export not found');
  }

  const assetId = payloadValue(job.payload, 'asset_id');
  if (!assetId) return problem(404, 'Export not found');
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
      'expires_at',
      'soft_deleted_at',
    ])
    .where('id', '=', assetId)
    .where('project_id', '=', access.projectId)
    .where('purpose', '=', 'export')
    .where('visibility', '=', 'private')
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!asset) return problem(404, 'Export not found');

  const now = new Date();
  if (!asset.expires_at || asset.expires_at <= now) return problem(410, 'Export expired');

  let contentType: 'text/csv' | 'application/json';
  try {
    const normalized = normalizeContentType(asset.content_type);
    if (normalized !== 'text/csv' && normalized !== 'application/json') {
      return problem(503, 'Storage unavailable', 'Export metadata is invalid');
    }
    contentType = normalized;
    assertExportKey(asset.storage_key);
  } catch {
    return problem(503, 'Storage unavailable', 'Export metadata is invalid');
  }

  const expectedKey = `exports/${access.projectId}/${job.id}.${contentType === 'text/csv' ? 'csv' : 'json'}`;
  if (asset.storage_key !== expectedKey) return problem(404, 'Export not found');

  const contentLength = Number(asset.byte_size);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1) {
    return problem(503, 'Storage unavailable', 'Export metadata is invalid');
  }

  try {
    const object = await getStorage().getObjectStream(BUCKETS.exports, asset.storage_key);
    let objectContentType: string | undefined;
    try {
      objectContentType =
        object.contentType === undefined ? undefined : normalizeContentType(object.contentType);
    } catch {
      objectContentType = '';
    }
    if (
      object.contentLength !== contentLength ||
      (objectContentType !== undefined && objectContentType !== contentType)
    ) {
      await object.body.cancel().catch(() => undefined);
      return problem(503, 'Storage unavailable', 'Export metadata mismatch');
    }
    return new Response(object.body, {
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition': `attachment; filename="export.${contentType === 'text/csv' ? 'csv' : 'json'}"`,
        'content-length': String(contentLength),
        'content-type': contentType,
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return problem(503, 'Storage unavailable', 'Export read failed');
  }
};
