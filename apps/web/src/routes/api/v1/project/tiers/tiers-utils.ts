import { TierSchema } from '@oss-tips/api-contracts';
import type { Db } from '@oss-tips/db';
import { toTier } from '../../../public-api';

export async function listProjectTiers(db: Db, projectId: string, includeInactive = false) {
  let query = db
    .selectFrom('tier')
    .selectAll()
    .where('project_id', '=', projectId)
    .orderBy('rank', 'asc')
    .orderBy('created_at', 'asc');
  if (!includeInactive) query = query.where('is_active', '=', true);
  const tiers = await query.execute();
  if (!tiers.length) return [];
  const prices = await db
    .selectFrom('tier_price')
    .select(['tier_id', 'cadence', 'amount_minor', 'currency'])
    .where(
      'tier_id',
      'in',
      tiers.map((tier) => tier.id),
    )
    .where('is_active', '=', true)
    .execute();
  const rewards = await db
    .selectFrom('tier_reward')
    .select(['tier_id', 'label'])
    .where(
      'tier_id',
      'in',
      tiers.map((tier) => tier.id),
    )
    .orderBy('created_at', 'asc')
    .execute();
  return tiers.map((tier) =>
    TierSchema.parse(
      toTier(
        tier,
        prices.filter((price) => price.tier_id === tier.id),
        rewards.filter((reward) => reward.tier_id === tier.id).map((reward) => reward.label),
      ),
    ),
  );
}

export function normalizeDuration(value: string | null | undefined): string | null | undefined {
  return value === undefined ? undefined : value === null || value === 'none' ? null : value;
}
