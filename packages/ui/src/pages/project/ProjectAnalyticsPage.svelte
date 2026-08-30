<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';
  import type { Analytics, NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import SupportOverTimeChart from '../../components/SupportOverTimeChart.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import type { ChartSeries } from './project-demo.js';
  import {
    analyticsBreakdown,
    supportOverTimeSeries,
    supporterGrowthSeries,
  } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatCurrency, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    supportSeries?: ChartSeries[];
    growthSeries?: ChartSeries[];
    breakdown?: Array<{
      source: string;
      gross: string;
      fees: string;
      net: string;
      share: string;
      grossMinor?: number;
      feesMinor?: number;
      netMinor?: number;
      currency?: string;
    }>;
    metrics?: Array<{
      label: string;
      value: string;
      compare: string;
      compareDirection: 'up';
      valueMinor?: number;
      valueNumber?: number;
      currency?: string;
    }>;
    analytics?: Analytics;
    pageState?: 'ready' | 'error' | 'permission';
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    supportSeries = supportOverTimeSeries,
    growthSeries = supporterGrowthSeries,
    breakdown = analyticsBreakdown,
    metrics = [],
    analytics,
    pageState = 'ready',
  }: Props = $props();

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const percentage = (value: number) =>
    new Intl.NumberFormat($locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
  const metricRows = $derived(
    metrics.slice(0, 3).map((metric, index) => ({
      ...metric,
      label: [
        tx('project.analytics.totalSupport'),
        tx('project.analytics.newSupporters'),
        tx('project.analytics.monthlyRecurring'),
      ][index] ?? metric.label,
      value:
        metric.valueMinor !== undefined
          ? formatCurrency(metric.valueMinor, metric.currency ?? project.currency, $locale)
          : metric.valueNumber !== undefined
            ? formatNumber(metric.valueNumber, $locale)
            : metric.value,
    })),
  );
  const cards = $derived(
    analytics
      ? [
          ...metricRows,
          {
            label: tx('project.analytics.netAfterFees'),
            value: formatCurrency(analytics.netRevenue30dMinor, analytics.currency || project.currency, $locale),
            compare: analytics.periodLabel,
            compareDirection: 'up' as const,
          },
          {
            label: tx('project.analytics.refunds'),
            value: '—',
            compare: tx('common.notAvailable'),
            compareDirection: 'down' as const,
          },
          {
            label: tx('project.analytics.churn'),
            value: percentage(analytics.churnPercent),
            compare: analytics.periodLabel,
            compareDirection: 'down' as const,
          },
        ]
      : metricRows,
  );
  const breakdownRows = $derived(
    breakdown.map((row) => ({
      ...row,
      gross: row.grossMinor !== undefined ? formatCurrency(row.grossMinor, row.currency ?? project.currency, $locale) : row.gross,
      fees: row.feesMinor !== undefined ? formatCurrency(row.feesMinor, row.currency ?? project.currency, $locale) : row.fees,
      net: row.netMinor !== undefined ? formatCurrency(row.netMinor, row.currency ?? project.currency, $locale) : row.net,
    })),
  );
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.analytics.title')}
  lede={tx('project.analytics.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.analytics.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.analytics.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.analytics.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.analytics.permissionBody')}</p>
    </div>
  {:else}
  <div class={stylex.attrs(projectStyles.grid3, projectStyles.responsiveGrid3).class}>
    {#each cards as card (card.label)}
      <DataCard label={card.label} value={card.value} compare={card.compare} compareDirection={card.compareDirection} />
    {/each}
  </div>

  {#if supportSeries.length > 0 || growthSeries.length > 0}
    <div class={stylex.attrs(projectStyles.stack, projectStyles.section).class}>
      <SupportOverTimeChart
        label={tx('project.analytics.supportOverTime')}
        range={tx('project.analytics.range')}
        series={supportSeries}
        currency={project.currency}
      />
      <SupportOverTimeChart
        label={tx('project.analytics.supporterGrowth')}
        range={tx('project.analytics.range')}
        series={growthSeries}
        valuePrefix=""
      />
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.empty, projectStyles.section).class}>
      <strong>{tx('project.analytics.noData')}</strong>
      <span class={stylex.attrs(projectStyles.muted, projectStyles.small).class}>
        {tx('project.analytics.noDataBody')}
      </span>
    </div>
  {/if}

  <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.analytics.revenueMix')}</h2>
  {#if breakdown.length > 0}
    <Table
      caption={tx('project.analytics.revenueCaption', { project: project.name })}
      columns={[
        { key: 'source', label: tx('project.analytics.source') },
        { key: 'gross', label: tx('project.analytics.gross') },
        { key: 'fees', label: tx('project.analytics.feesColumn') },
        { key: 'net', label: tx('project.analytics.net') },
        { key: 'share', label: tx('project.analytics.share') },
      ]}
      rows={breakdownRows}
    />
  {:else}
    <div class={stylex.attrs(projectStyles.empty).class}>{tx('project.analytics.noRevenue')}</div>
  {/if}
  {/if}
</ProjectDashShell>
