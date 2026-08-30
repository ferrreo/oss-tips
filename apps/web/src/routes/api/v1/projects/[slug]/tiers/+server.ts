import { TierSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { jsonWithEtag, problem } from '../../../../api-utils';
import { toTier } from '../../../../public-api';

export const GET: RequestHandler = async ({ params, request }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug) return problem(400, 'Missing project slug');

  const db = getDb();
  const project = await db
    .selectFrom('project')
    .select(['id'])
    .where('slug', '=', params.slug)
    .where('status', '=', 'published')
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');

  const tiers = await db
    .selectFrom('tier')
    .select([
      'id',
      'name',
      'rank',
      'description',
      'icon',
      'member_cap',
      'one_off_duration',
      'minimum_visibility',
      'badge',
      'discord_role_ids',
    ])
    .where('project_id', '=', project.id)
    .where('is_active', '=', true)
    .orderBy('rank', 'asc')
    .execute();
  const prices = tiers.length
    ? await db
        .selectFrom('tier_price')
        .select(['tier_id', 'cadence', 'amount_minor', 'currency'])
        .where(
          'tier_id',
          'in',
          tiers.map((tier) => tier.id),
        )
        .where('is_active', '=', true)
        .execute()
    : [];
  const rewards = tiers.length
    ? await db
        .selectFrom('tier_reward')
        .select(['tier_id', 'label'])
        .where(
          'tier_id',
          'in',
          tiers.map((tier) => tier.id),
        )
        .orderBy('created_at', 'asc')
        .execute()
    : [];
  const payload = tiers.map((tier) =>
    TierSchema.parse(
      toTier(
        tier,
        prices.filter((price) => price.tier_id === tier.id),
        rewards.filter((reward) => reward.tier_id === tier.id).map((reward) => reward.label),
      ),
    ),
  );
  return jsonWithEtag(request, payload);
};
