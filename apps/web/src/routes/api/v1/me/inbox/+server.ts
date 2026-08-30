import { InboxThreadSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const rows = await getDb()
    .selectFrom('supporter_message_thread')
    .select(['id', 'project_id', 'updated_at'])
    .where('supporter_user_id', '=', session.userId)
    .orderBy('updated_at', 'desc')
    .limit(100)
    .execute();
  const payload = rows.map((row) =>
    InboxThreadSchema.parse({
      id: row.id,
      project_id: row.project_id,
      subject: 'Support conversation',
      updated_at: row.updated_at.toISOString(),
      unread: false,
    }),
  );
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};
