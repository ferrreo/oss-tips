import { describe, expect, it } from 'vitest';
import {
  analyticsBreakdown,
  extraGoals,
  extraPayments,
  extraPosts,
  extraThreads,
  inboxPreviewRows,
  inboxThreads,
  membershipRows,
  supportOverTimeLabels,
  supportOverTimeSeries,
  supporterGrowthSeries,
  toolCards,
} from './project-demo.js';

describe('project dashboard fixtures', () => {
  it('keeps chart series aligned with month labels', () => {
    expect(supportOverTimeLabels.length).toBe(12);
    for (const series of [...supportOverTimeSeries, ...supporterGrowthSeries]) {
      expect(series.values.length).toBe(12);
      expect(series.label.length).toBeGreaterThan(0);
    }
  });

  it('supplies complete extra records for stories', () => {
    expect(extraGoals.every((goal) => goal.percentLabel && goal.title)).toBe(true);
    expect(extraPayments.every((payment) => payment.reference && payment.method)).toBe(true);
    expect(extraPosts.every((post) => post.body && post.publishedLabel)).toBe(true);
    expect(extraThreads.every((thread) => thread.preview && thread.messages.length > 0)).toBe(true);
  });

  it('keeps inbox previews aligned with threads', () => {
    expect(inboxPreviewRows.length).toBe(inboxThreads.length);
    expect(inboxPreviewRows[0]?.id).toBe(inboxThreads[0]?.id);
    expect(inboxPreviewRows.every((row) => row.snippet && row.amount)).toBe(true);
  });

  it('gives tool cards real destinations and CTAs', () => {
    expect(toolCards.every((tool) => tool.href.startsWith('/grove/') && tool.cta.length > 0)).toBe(true);
  });

  it('fills analytics and membership tables', () => {
    expect(analyticsBreakdown.length).toBeGreaterThan(0);
    expect(membershipRows.every((row) => row.tier && row.amount)).toBe(true);
  });
});
