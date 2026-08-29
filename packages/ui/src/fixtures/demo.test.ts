import { describe, expect, it } from 'vitest';
import {
  demoActivity,
  demoAdminQueue,
  demoAnalytics,
  demoApiKeys,
  demoAuditEvents,
  demoCases,
  demoChartSeries,
  demoCountries,
  demoDiscordMappings,
  demoEntitlements,
  demoExports,
  demoGoals,
  demoMemberships,
  demoMetrics,
  demoPayments,
  demoPosts,
  demoProject,
  demoReferrers,
  demoReconciliationDiffs,
  demoRetention,
  demoReviewQueue,
  demoSupporters,
  demoTeam,
  demoThreads,
  demoTiers,
  demoTopSupporters,
  demoWebhooks,
  featuredProjects,
  formatMoney,
  formatPercent,
} from './demo.js';

const defaultStorySources = {
  demoActivity,
  demoAdminQueue,
  demoApiKeys,
  demoAuditEvents,
  demoCases,
  demoChartSeriesPoints: demoChartSeries.points,
  demoCountries,
  demoDiscordMappings,
  demoEntitlements,
  demoExports,
  demoGoals,
  demoMemberships,
  demoPayments,
  demoPosts,
  demoReferrers,
  demoReconciliationDiffs,
  demoRetention,
  demoSupporters,
  demoTeam,
  demoThreads,
  demoTiers,
  demoTopSupporters,
  demoWebhooks,
  featuredProjects,
  analyticsReferrers: demoAnalytics.referrers,
  analyticsCountries: demoAnalytics.countries,
  analyticsRetention: demoAnalytics.retention,
};

function collectStrings(value: unknown, path: string, found: Array<{ path: string; value: string }>): void {
  if (typeof value === 'string') {
    found.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, found));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, `${path}.${key}`, found);
    }
  }
}

describe('branded demo fixtures', () => {
  it('matches mockup metrics', () => {
    expect(demoMetrics.totalSupportMinor).toBe(1284100);
    expect(demoMetrics.totalSupportLabel).toBe('$12,841');
    expect(demoMetrics.newSupporters).toBe(284);
    expect(demoMetrics.newSupportersDeltaPercent).toBe(24.1);
    expect(demoMetrics.newSupportersDeltaLabel).toBe('+24.1%');
    expect(demoMetrics.mrrMinor).toBe(642100);
    expect(demoMetrics.mrrLabel).toBe('$6,421');
    expect(demoMetrics.mrrDeltaPercent).toBe(22.7);
    expect(demoMetrics.mrrDeltaLabel).toBe('+22.7%');
    expect(demoProject.stats.totalSupportMinor).toBe(1284100);
    expect(demoProject.stats.supporters).toBe(284);
    expect(demoProject.stats.monthlyRecurringMinor).toBe(642100);
    expect(demoProject.currency).toBe('USD');
  });

  it('matches mockup goals', () => {
    const infrastructure = demoGoals.find((goal) => goal.title === 'Infrastructure upgrade');
    const docs = demoGoals.find((goal) => goal.title === 'Documentation overhaul');
    expect(infrastructure?.raisedMinor).toBe(4523000);
    expect(infrastructure?.targetMinor).toBe(7500000);
    expect(formatPercent(4523000, 7500000)).toBe(60);
    expect(docs?.percentLabel).toBe('62%');
    expect(docs && formatPercent(docs.raisedMinor, docs.targetMinor)).toBe(62);
  });

  it('uses branded tiers with reward lists', () => {
    expect(demoTiers.map((tier) => tier.name)).toEqual(['Coffee', 'Supporter', 'Backer', 'Champion']);
    expect(demoTiers[0]?.monthlyMinor).toBe(500);
    expect(demoTiers[1]?.monthlyMinor).toBe(1000);
    expect(demoTiers[1]?.popular).toBe(true);
    expect(demoTiers[2]?.monthlyMinor).toBe(2500);
    expect(demoTiers[3]?.monthlyMinor).toBe(10000);
    for (const tier of demoTiers) {
      expect(tier.rewards.length).toBeGreaterThan(0);
      expect(tier.description.length).toBeGreaterThan(0);
    }
  });

  it('fills the supporter wall with named messages', () => {
    const publicWall = demoSupporters.filter((supporter) => supporter.public);
    expect(publicWall.length).toBeGreaterThanOrEqual(8);
    const handles = publicWall.map((supporter) => supporter.handle);
    expect(handles).toEqual(expect.arrayContaining(['alex_dev', 'lara_code', 'jane_dev', 'opensourcefan']));
    for (const supporter of publicWall) {
      expect(supporter.message.length).toBeGreaterThan(0);
      expect(supporter.displayName.length).toBeGreaterThan(0);
      expect(supporter.relativeTime.length).toBeGreaterThan(0);
    }
  });

  it('ships full inbox, payments, posts, and ranked lists', () => {
    expect(demoThreads.length).toBeGreaterThanOrEqual(6);
    expect(demoPayments.length).toBeGreaterThanOrEqual(10);
    expect(demoPosts.length).toBeGreaterThanOrEqual(5);
    expect(demoTopSupporters.length).toBeGreaterThanOrEqual(5);
    expect(demoActivity.length).toBeGreaterThanOrEqual(5);
    expect(demoAdminQueue.length).toBeGreaterThanOrEqual(5);
    expect(demoReconciliationDiffs.length).toBeGreaterThanOrEqual(5);
    expect(demoAuditEvents.length).toBeGreaterThanOrEqual(5);
    expect(demoReviewQueue).toBe(demoAdminQueue);
    for (const thread of demoThreads) {
      expect(thread.amountMinor).toBeGreaterThan(0);
      expect(thread.relativeTime.length).toBeGreaterThan(0);
      expect(thread.messages.length).toBeGreaterThan(0);
      expect(thread.messages[0]?.body.length).toBeGreaterThan(0);
    }
    expect(demoTopSupporters.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('exports a 30-day rising Apr–May chart', () => {
    expect(demoChartSeries.points).toHaveLength(30);
    expect(demoChartSeries.points[0]?.label).toMatch(/^Apr /);
    expect(demoChartSeries.points[29]?.label).toMatch(/^May /);
    const last = demoChartSeries.points[29];
    expect(last?.recurring).toBe(642100);
    expect(last?.oneOff).toBe(642000);
    expect(last?.total).toBe(1284100);
    const first = demoChartSeries.points[0];
    expect(first && last && last.total).toBeGreaterThan(first?.total ?? 0);
    expect(first && last && last.recurring).toBeGreaterThan(first?.recurring ?? 0);
    for (const point of demoChartSeries.points) {
      expect(point.label.length).toBeGreaterThan(0);
      expect(point.date.length).toBeGreaterThan(0);
      expect(point.total).toBe(point.oneOff + point.recurring);
    }
  });

  it('includes analytics breakdowns', () => {
    expect(demoAnalytics.referrers.length).toBeGreaterThan(0);
    expect(demoAnalytics.countries.length).toBeGreaterThan(0);
    expect(demoAnalytics.retention.length).toBeGreaterThan(0);
    expect(demoAnalytics.netRevenue30dMinor).toBe(1284100);
    expect(demoAnalytics.newSupporters30d).toBe(284);
    expect(demoReferrers[0]?.source).toBe('github.com');
    expect(demoCountries[0]?.country).toBe('United States');
    expect(demoRetention[0]?.monthLabel).toMatch(/2026/);
  });

  it('never uses empty labels or empty default story sources', () => {
    for (const [name, source] of Object.entries(defaultStorySources)) {
      expect(source.length, name).toBeGreaterThan(0);
    }

    const strings: Array<{ path: string; value: string }> = [];
    collectStrings(
      {
        demoMetrics,
        demoChartSeries,
        demoProject,
        ...defaultStorySources,
      },
      'fixtures',
      strings,
    );
    const empties = strings.filter((entry) => entry.value.trim() === '');
    expect(empties).toEqual([]);
  });

  it('formats mockup money', () => {
    expect(formatMoney(1284100, 'USD')).toBe('$12,841.00');
    expect(formatMoney(642100, 'USD')).toBe('$6,421.00');
    expect(formatMoney(4523000, 'USD')).toBe('$45,230.00');
    expect(formatMoney(7500000, 'USD')).toBe('$75,000.00');
  });
});
