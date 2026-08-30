import { SupportRecordSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import {
  readPublicSupportAdjustments,
  visiblePublicSupportPayments,
} from '$lib/server/public-supporters';

const SUPPORT_STATUSES = new Set(['processing', 'succeeded', 'refunded', 'disputed']);

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const db = getDb();
  const rows = await db
    .selectFrom('payment')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .select([
      'payment.id',
      'payment.project_id',
      'payment.user_id',
      'project.slug as project_slug',
      'payment.project_amount_minor',
      'payment.currency',
      'payment.cadence',
      'payment.status',
      'payment.created_at',
      'payment.settled_at',
    ])
    .where('payment.user_id', '=', session.userId)
    .where('payment.status', 'in', ['succeeded', 'refunded', 'disputed'])
    .orderBy('payment.created_at', 'desc')
    .limit(100)
    .execute();
  const adjustments = await readPublicSupportAdjustments(
    db,
    rows.map((row) => row.id),
  );
  const payload = visiblePublicSupportPayments(rows, adjustments).map(({ row, amountMinor }) =>
    SupportRecordSchema.parse({
      id: row.id,
      project_id: row.project_id,
      project_slug: row.project_slug,
      amount: { amount: String(amountMinor), currency: row.currency.toLowerCase() },
      status: SUPPORT_STATUSES.has(row.status) ? row.status : 'processing',
      created_at: row.created_at.toISOString(),
    }),
  );
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};
