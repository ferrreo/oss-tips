import { MembershipSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const rows = await getDb()
    .selectFrom('subscription')
    .select([
      'id',
      'project_id',
      'tier_id',
      'status',
      'current_period_end',
      'cancel_at_period_end',
      'platform_tip_minor',
      'currency',
    ])
    .where('user_id', '=', session.userId)
    .orderBy('created_at', 'desc')
    .limit(100)
    .execute();
  const payload = rows.map((row) =>
    MembershipSchema.parse({
      id: row.id,
      project_id: row.project_id,
      tier_id: row.tier_id,
      status: ['active', 'grace', 'cancelled', 'expired', 'incomplete'].includes(row.status)
        ? row.status
        : 'incomplete',
      current_period_end: row.current_period_end?.toISOString() ?? null,
      cancel_at_period_end: row.cancel_at_period_end,
      platform_tip:
        row.platform_tip_minor === null || row.currency === null
          ? null
          : { amount: String(row.platform_tip_minor), currency: row.currency.toLowerCase() },
    }),
  );
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};
