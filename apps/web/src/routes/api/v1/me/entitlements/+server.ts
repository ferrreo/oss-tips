import { EntitlementSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const rows = await getDb()
    .selectFrom('entitlement')
    .select(['id', 'project_id', 'kind', 'tier_rank', 'starts_at', 'ends_at'])
    .where('user_id', '=', session.userId)
    .where('revoked_at', 'is', null)
    .orderBy('created_at', 'desc')
    .limit(100)
    .execute();
  const payload = rows.map((row) =>
    EntitlementSchema.parse({
      id: row.id,
      project_id: row.project_id,
      kind: row.kind === 'membership' ? 'membership' : 'one_off',
      tier_rank: row.tier_rank,
      starts_at: row.starts_at.toISOString(),
      ends_at: row.ends_at?.toISOString() ?? null,
    }),
  );
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};
