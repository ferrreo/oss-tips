import type { Project, Tier, ProjectGoal, Post } from '@oss-tips/db';
import type {
  ProjectSummary,
  Tier as ApiTier,
  Goal,
  PostSummary,
  PublicSupporter,
  ProjectPost,
} from '@oss-tips/api-contracts';
import { paymentReadiness, paymentsEnabled } from '@oss-tips/domain';

type ConnectedAccount =
  | {
      stripe_account_id?: string | null;
      charges_enabled?: boolean | null;
      payouts_enabled?: boolean | null;
      capabilities?: unknown;
    }
  | null
  | undefined;

function normalizedValues(values: readonly string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function publicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function toProjectSummary(
  row: Pick<
    Project,
    'id' | 'slug' | 'name' | 'description' | 'status' | 'default_currency' | 'updated_at'
  > &
    Partial<
      Pick<
        Project,
        | 'website_url'
        | 'logo_asset_id'
        | 'banner_asset_id'
        | 'discovery_ecosystems'
        | 'discovery_languages'
        | 'discovery_tags'
      >
    >,
  baseUrl: string,
  connected?: ConnectedAccount,
  tags: string[] = [],
  repositoryUrl: string | null = null,
): ProjectSummary {
  const publicTags = normalizedValues([...(row.discovery_tags ?? []), ...tags]);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    canonical_url: `${baseUrl}/${row.slug}`,
    payment_status:
      row.status === 'restricted'
        ? 'restricted'
        : paymentsEnabled(
              paymentReadiness({
                connectedAccountId: connected?.stripe_account_id,
                chargesEnabled: connected?.charges_enabled,
                payoutsEnabled: connected?.payouts_enabled,
                capabilities: connected?.capabilities,
              }),
            )
          ? 'active'
          : 'pending',
    tags: publicTags,
    website_url: publicUrl(row.website_url),
    repository_url: publicUrl(repositoryUrl),
    logo_asset_id: row.logo_asset_id ?? null,
    banner_asset_id: row.banner_asset_id ?? null,
    ecosystems: normalizedValues(row.discovery_ecosystems),
    languages: normalizedValues(row.discovery_languages),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toMoney(amount: string | number | bigint, currency: string) {
  return { amount: String(amount), currency: currency.toLowerCase() };
}

export function toTier(
  row: Pick<Tier, 'id' | 'name' | 'rank'> &
    Partial<
      Pick<
        Tier,
        | 'description'
        | 'icon'
        | 'member_cap'
        | 'one_off_duration'
        | 'minimum_visibility'
        | 'badge'
        | 'discord_role_ids'
      >
    >,
  prices: Array<{ cadence: string; amount_minor: string | number | bigint; currency: string }>,
  benefits: string[] = [],
): ApiTier {
  const price = (cadence: string) =>
    prices.find((item) => item.cadence === cadence && item.amount_minor !== null);
  const monthly = price('monthly');
  const annual = price('annual');
  const oneOff = price('one_off');
  return {
    id: row.id,
    name: row.name,
    rank: row.rank,
    description: row.description ?? null,
    icon: row.icon ?? null,
    member_cap: row.member_cap ?? null,
    one_off_duration:
      row.one_off_duration === 'days_30' ||
      row.one_off_duration === 'days_90' ||
      row.one_off_duration === 'year' ||
      row.one_off_duration === 'permanent'
        ? row.one_off_duration
        : row.one_off_duration === 'days_365'
          ? 'year'
          : null,
    minimum_visibility:
      row.minimum_visibility === 'signed_in_supporter' ||
      row.minimum_visibility === 'minimum_tier' ||
      row.minimum_visibility === 'selected_tiers'
        ? row.minimum_visibility
        : 'public',
    discord_roles: row.discord_role_ids ?? [],
    badge: row.badge ?? null,
    one_off_amount: oneOff ? toMoney(oneOff.amount_minor, oneOff.currency) : null,
    monthly_amount: monthly ? toMoney(monthly.amount_minor, monthly.currency) : null,
    annual_amount: annual ? toMoney(annual.amount_minor, annual.currency) : null,
    benefits,
  };
}

export function toGoal(
  row: Pick<
    ProjectGoal,
    'id' | 'title' | 'goal_type' | 'target_minor' | 'target_count' | 'currency' | 'updated_at'
  > &
    Partial<Pick<ProjectGoal, 'status' | 'deadline' | 'basis'>>,
  progressMinor = 0n,
  progressCount = 0,
): Goal {
  const isCount = row.goal_type === 'supporter_count' || row.goal_type === 'active_supporter_count';
  const target = isCount
    ? row.target_count
    : row.target_minor === null || !row.currency
      ? null
      : toMoney(row.target_minor, row.currency);
  const targetNumber = isCount
    ? row.target_count
    : row.target_minor === null
      ? null
      : Number(row.target_minor);
  const progress = isCount ? progressCount : Number(progressMinor);
  return {
    id: row.id,
    title: row.title,
    type:
      row.goal_type === 'recurring_money'
        ? 'recurring_money'
        : row.goal_type === 'mrr'
          ? 'mrr'
          : row.goal_type === 'calendar_month_money'
            ? 'calendar_month_money'
            : row.goal_type === 'active_supporter_count'
              ? 'active_supporter_count'
              : isCount
                ? 'supporter_count'
                : 'one_time_money',
    target,
    progress_percent:
      targetNumber && targetNumber > 0 ? Math.min(100, (progress / targetNumber) * 100) : 0,
    status: row.status === 'draft' || row.status === 'archived' ? row.status : 'published',
    deadline: row.deadline?.toISOString() ?? null,
    basis: row.basis ?? null,
    updated_at: row.updated_at.toISOString(),
  };
}

export function toPostSummary(
  row: Pick<Post, 'id' | 'slug' | 'title' | 'published_at' | 'status'>,
  gated = false,
): PostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    published_at: row.published_at?.toISOString() ?? null,
    gated,
  };
}

export function toProjectPost(
  row: Pick<Post, 'id' | 'slug' | 'title' | 'published_at' | 'status'> &
    Partial<Pick<Post, 'scheduled_at' | 'notify_supporters'>>,
  body: string | null,
  minimumTierRank: number | null,
  gated = minimumTierRank !== null,
): ProjectPost {
  return {
    ...toPostSummary(row, gated),
    body,
    minimum_tier_rank: minimumTierRank,
    scheduled_at: row.scheduled_at?.toISOString() ?? null,
    notify_supporters: row.notify_supporters ?? false,
  };
}

export function toPublicSupporter(input: {
  display_name: string | null;
  show_name: boolean;
  show_amount: boolean;
  show_message?: boolean;
  amount?: string | number | bigint | null;
  currency?: string | null;
  message?: string | null;
  duration?: string | null;
  created_at: Date;
}): PublicSupporter {
  const duration = input.duration === 'days_365' ? 'year' : input.duration;
  return {
    display_name: input.show_name ? input.display_name : null,
    ...(input.show_amount && input.amount !== null && input.amount !== undefined && input.currency
      ? { amount: toMoney(input.amount, input.currency) }
      : {}),
    message: input.show_message ? (input.message ?? null) : null,
    ...(duration ? { duration } : {}),
    created_at: input.created_at.toISOString(),
  };
}
