import { MeSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const row = await getDb()
    .selectFrom('user')
    .select(['id', 'email', 'name', 'created_at'])
    .where('id', '=', session.userId)
    .executeTakeFirst();
  if (!row) return problem(404, 'User not found');
  const payload = MeSchema.parse({
    id: row.id,
    email: row.email,
    display_name: row.name,
    created_at: row.created_at.toISOString(),
  });
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};
