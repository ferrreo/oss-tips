import { GoalSchema } from '@oss-tips/api-contracts';
import { countCurrentEntitlementSupporters, listCurrentForProject } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { netSettledProjectAmountMinor } from '$lib/server/page-data';
import { jsonWithEtag, problem } from '../../../../api-utils';
import { toGoal } from '../../../../public-api';

export const GET: RequestHandler = async ({ params, request }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug) return problem(400, 'Missing project slug');

  const db = getDb();
  const project = await db
    .selectFrom('project')
    .select(['id', 'default_currency', 'public_show_goal'])
    .where('slug', '=', params.slug)
    .where('status', '=', 'published')
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');

  const goals = await db
    .selectFrom('project_goal')
    .select([
      'id',
      'title',
      'goal_type',
      'target_minor',
      'target_count',
      'currency',
      'status',
      'deadline',
      'basis',
      'updated_at',
    ])
    .where('project_id', '=', project.id)
    .where('is_active', '=', true)
    .where('status', '=', 'published')
    .orderBy('created_at', 'asc')
    .execute();
  if (!project.public_show_goal) return jsonWithEtag(request, []);

  const payments = await db
    .selectFrom('payment')
    .select([
      'id',
      'user_id',
      'currency',
      'cadence',
      'project_amount_minor',
      'status',
      'created_at',
      'settled_at',
    ])
    .where('project_id', '=', project.id)
    .execute();
  const paymentIds = payments.map((payment) => payment.id);
  const [refunds, disputes] = await Promise.all([
    paymentIds.length
      ? db
          .selectFrom('refund')
          .select(['payment_id', 'amount_minor', 'application_fee_refund_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
    paymentIds.length
      ? db
          .selectFrom('payment_dispute')
          .select(['payment_id', 'amount_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
  ]);
  const currentEntitlements = await listCurrentForProject(db, project.id);
  const currentSupporterCount = countCurrentEntitlementSupporters(currentEntitlements);
  const payload = goals.map((goal) => {
    const isCountGoal =
      goal.goal_type === 'supporter_count' || goal.goal_type === 'active_supporter_count';
    const currency = (goal.currency ?? project.default_currency).toLowerCase();
    const eligible = isCountGoal
      ? []
      : payments.filter((payment) => payment.currency.toLowerCase() === currency);
    const settled = eligible.filter(
      (payment) => netSettledProjectAmountMinor(payment, refunds, disputes) > 0n,
    );
    const progressMinor = settled.reduce(
      (sum, payment) => sum + netSettledProjectAmountMinor(payment, refunds, disputes),
      0n,
    );
    const progressCount = isCountGoal ? currentSupporterCount : 0;
    return GoalSchema.parse(toGoal(goal, progressMinor, progressCount));
  });
  return jsonWithEtag(request, payload);
};
