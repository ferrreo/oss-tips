import { AnalyticsSummarySchema } from '@oss-tips/api-contracts';
import { getProjectAnalytics } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { authorizeProject, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.view_analytics', 'analytics:read');
  if (access instanceof Response) return access;
  const rawDays = event.url.searchParams.get('days');
  const days = rawDays === null ? 30 : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return problem(400, 'Invalid analytics period', 'days must be an integer between 1 and 365');
  }
  const analytics = await getProjectAnalytics(db, access.projectId, { days });
  const money = (value: { amount: string; currency: string }) => value;
  return json(
    AnalyticsSummarySchema.parse({
      period_start: analytics.periodStart,
      period_end: analytics.periodEnd,
      currency: analytics.currency,
      gross_settled_support: money(analytics.grossSettledSupport),
      refunds_disputes: money(analytics.refundsDisputes),
      oss_tips_fee: money(analytics.ossTipsFee),
      oss_tips_tip: money(analytics.ossTipsTip),
      stripe_fee: analytics.stripeFee ? money(analytics.stripeFee) : null,
      estimated_net: money(analytics.estimatedNet),
      one_off: money(analytics.oneOff),
      recurring: money(analytics.recurring),
      mrr: money(analytics.mrr),
      arr: money(analytics.arr),
      active_members: analytics.activeMembers,
      membership_lifecycle: analytics.membershipLifecycle,
      retention: analytics.retention.map((row) => ({
        cohort: row.cohort,
        started: row.started,
        retained: row.retained,
        retention_percent: row.retentionPercent,
        churn_percent: row.churnPercent,
      })),
      tier_mix: analytics.tierMix.map((row) => ({
        tier_id: row.tierId,
        tier_name: row.tierName,
        members: row.members,
        share_percent: row.sharePercent,
      })),
      country_distribution: analytics.countries.map((row) => ({
        country: row.country,
        supporters: row.supporters,
        share_percent: row.sharePercent,
      })),
      referrer_distribution: analytics.referrers.map((row) => ({
        referrer: row.referrer,
        page_views: row.pageViews,
        composer_opens: row.composerOpens,
        confirmed_conversions: row.confirmedConversions,
        conversion_percent: row.conversionPercent,
        share_percent: row.sharePercent,
      })),
      conversion: {
        page_views: analytics.conversion.pageViews,
        composer_opens: analytics.conversion.composerOpens,
        confirmed_conversions: analytics.conversion.confirmedConversions,
        conversion_percent: analytics.conversion.conversionPercent,
      },
      goal_progress: analytics.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        goal_type: goal.goalType,
        currency: goal.currency,
        target: goal.target,
        target_count: goal.targetCount,
        current: goal.current,
        current_count: goal.currentCount,
        percent: goal.percent,
      })),
      support_series: analytics.supportSeries,
      growth_series: analytics.growthSeries,
      breakdown: analytics.breakdown.map((row) => ({
        source: row.source,
        gross: row.gross,
        fees: row.fees,
        net: row.net,
        share_percent: row.sharePercent,
      })),
      currencies: analytics.currencies.map((row) => ({
        currency: row.currency,
        gross_settled_support: row.grossSettledSupport,
        refunds_disputes: row.refundsDisputes,
        oss_tips_fee: row.ossTipsFee,
        oss_tips_tip: row.ossTipsTip,
        stripe_fee: row.stripeFee,
        estimated_net: row.estimatedNet,
        one_off: row.oneOff,
        recurring: row.recurring,
      })),
      stripe_fee_available: analytics.stripeFeeAvailable,
      provider_limitations: analytics.providerLimitations,
      one_off_total: money(analytics.oneOff),
    }),
    { headers: { 'cache-control': 'private, no-store' } },
  );
};
