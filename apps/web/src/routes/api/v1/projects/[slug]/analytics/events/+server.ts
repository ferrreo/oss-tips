import {
  PublicAnalyticsEventSchema,
  PublicAnalyticsEventResponseSchema,
} from '@oss-tips/api-contracts';
import { recordPublicAnalyticsEvent } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem, readJson } from '../../../../../api-utils';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!event.params.slug) return problem(400, 'Missing project slug');

  const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255 || /[\r\n]/.test(idempotencyKey)) {
    return problem(400, 'Idempotency key required', 'Public analytics events must be retry-safe');
  }
  const body = await readJson(event.request, PublicAnalyticsEventSchema);
  if (body instanceof Response) return body;
  const db = getDb();
  const project = await db
    .selectFrom('project')
    .select('id')
    .where('slug', '=', event.params.slug)
    .where('status', '=', 'published')
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');

  try {
    const result = await recordPublicAnalyticsEvent(db, {
      projectId: project.id,
      event: body.event,
      idempotencyKey,
      referrer: body.referrer ?? event.request.headers.get('referer'),
      country: event.request.headers.get('cf-ipcountry'),
    });
    return json(PublicAnalyticsEventResponseSchema.parse(result), {
      status: result.duplicate ? 200 : 202,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('[analytics] failed to record public event', error);
    return problem(503, 'Analytics unavailable', 'Please retry the event');
  }
};
