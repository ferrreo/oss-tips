<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import type { Goal, NavGroup, Project } from '../../fixtures/demo.js';
  import { demoGoals, demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import SupportOverTimeChart from '../../components/SupportOverTimeChart.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import type { ChartSeries, InboxPreviewRow, RankedSupporter, ToolCard } from './project-demo.js';
  import {
    inboxPreviewRows,
    overviewMetrics,
    rankedSupporters,
    supportOverTimeSeries,
    toolCards,
  } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { formatCurrency, formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    metrics?: Array<{
      label: string;
      value: string;
      compare: string;
      compareDirection: 'up';
      valueMinor?: number;
      valueNumber?: number;
      currency?: string;
    }>;
    goals?: Goal[];
    inbox?: InboxPreviewRow[];
    supporters?: RankedSupporter[];
    tools?: ToolCard[];
    chartSeries?: ChartSeries[];
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    metrics = overviewMetrics,
    goals = demoGoals,
    inbox = inboxPreviewRows,
    supporters = rankedSupporters,
    tools = toolCards,
    chartSeries = supportOverTimeSeries,
  }: Props = $props();

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const cadenceLabel = (value: string) =>
    value === 'one-off' || value === 'one_off'
      ? tx('common.oneOff')
      : value === 'annual' || value === 'yearly'
        ? tx('common.annual')
        : tx('common.monthly');
  const metricRows = $derived(
    metrics.map((metric, index) => ({
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
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.overview.title')}
  lede={tx('project.overview.lede', { project: project.name })}
>
  <StatusBanner
    variant="warning"
    title={tx('project.overview.stripeWarning')}
    message={tx('project.overview.stripeWarningBody', { project: project.name })}
  />

  <div class={stylex.attrs(projectStyles.grid3, projectStyles.responsiveGrid3, projectStyles.section).class}>
    {#each metricRows as metric (metric.label)}
      <DataCard
        label={metric.label}
        value={metric.value}
        compare={metric.compare}
        compareDirection={metric.compareDirection}
      />
    {/each}
  </div>

  <div class={stylex.attrs(projectStyles.section).class}>
    <SupportOverTimeChart
      label={tx('project.analytics.supportOverTime')}
      range={tx('project.overview.supportRange')}
      series={chartSeries}
      currency={project.currency}
    />
  </div>

  <div class={stylex.attrs(projectStyles.grid2, projectStyles.responsiveStack, projectStyles.section).class}>
    <section class={stylex.attrs(projectStyles.surface).class}>
      <div class={stylex.attrs(projectStyles.between).class}>
        <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.overview.inboxHeading')}</h2>
        <Badge variant="forest" label={tx('project.overview.unread', { count: inbox.filter((row) => row.unread).length })} />
      </div>
      <ul class={stylex.attrs(projectStyles.inboxList).class}>
        {#each inbox.slice(0, 6) as row (row.id)}
          <li class={stylex.attrs(projectStyles.inboxRow).class}>
            <span class={stylex.attrs(projectStyles.avatar).class} aria-hidden="true">{row.initial}</span>
            <div class={stylex.attrs(projectStyles.truncate).class}>
              <div class={stylex.attrs(projectStyles.row).class}>
                <strong class={stylex.attrs(projectStyles.small).class}>{row.name}</strong>
                {#if row.unread}
                  <Badge variant="forest" label={tx('project.overview.new')} />
                {/if}
              </div>
              <p class={stylex.attrs(projectStyles.muted, projectStyles.small, projectStyles.truncate).class}>
                {row.snippet}
              </p>
            </div>
            <span class={stylex.attrs(projectStyles.numeric, projectStyles.small).class}>{row.amountMinor !== undefined ? formatCurrency(row.amountMinor, row.currency ?? project.currency, $locale) : row.amount}</span>
            <time class={stylex.attrs(projectStyles.muted, projectStyles.micro, projectStyles.compactHide).class} datetime={row.timeAt}>{row.timeAt ? formatDate(row.timeAt, $locale) : row.time}</time>
          </li>
        {:else}
          <li class={stylex.attrs(projectStyles.empty).class}>{tx('project.overview.inboxEmpty')}</li>
        {/each}
      </ul>
    </section>

    <section class={stylex.attrs(projectStyles.stack).class}>
      <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.overview.goalsHeading')}</h2>
      {#each goals as goal (goal.id)}
        <GoalProgress {goal} />
      {:else}
        <div class={stylex.attrs(projectStyles.empty).class}>
          <strong>{tx('project.overview.noGoalsTitle')}</strong>
          <span class={stylex.attrs(projectStyles.muted, projectStyles.small).class}>
            {tx('project.overview.noGoalsBody')}
          </span>
        </div>
      {/each}
    </section>
  </div>

  <section class={stylex.attrs(projectStyles.surface, projectStyles.section).class}>
    <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.overview.topSupporters')}</h2>
    <ol class={stylex.attrs(projectStyles.inboxList).class}>
      {#each supporters as supporter (supporter.rank)}
        <li class={stylex.attrs(projectStyles.topSupporter).class}>
          <div class={stylex.attrs(projectStyles.row).class}>
            <span class={stylex.attrs(projectStyles.rank, projectStyles.numeric).class}>{supporter.rank}</span>
            <span class={stylex.attrs(projectStyles.avatar, projectStyles.avatarSmall).class} aria-hidden="true">
              {supporter.initial}
            </span>
            <div>
              <strong class={stylex.attrs(projectStyles.small).class}>{supporter.name}</strong>
              <div class={stylex.attrs(projectStyles.muted, projectStyles.micro).class}>{cadenceLabel(supporter.cadence)}</div>
            </div>
          </div>
          <span class={stylex.attrs(projectStyles.numeric).class}>{supporter.amountMinor !== undefined ? formatCurrency(supporter.amountMinor, supporter.currency ?? project.currency, $locale) : supporter.amount}</span>
        </li>
      {:else}
        <li class={stylex.attrs(projectStyles.empty).class}>{tx('project.overview.noSupporters')}</li>
      {/each}
    </ol>
  </section>

  <section class={stylex.attrs(projectStyles.section).class}>
    <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.overview.tools')}</h2>
    <div class={stylex.attrs(projectStyles.autoGrid).class}>
      {#each tools as tool (tool.title)}
        <article class={stylex.attrs(projectStyles.surface, projectStyles.toolCard).class}>
          <h3 class={stylex.attrs(projectStyles.cardHeading).class}>{tool.title}</h3>
          <p class={stylex.attrs(projectStyles.body, projectStyles.toolBlurb).class}>{tool.blurb}</p>
          <a class={stylex.attrs(projectStyles.actionLink, primitives.focusRing).class} href={tool.href}>{tool.cta}</a>
        </article>
      {:else}
        <div class={stylex.attrs(projectStyles.empty).class}>{tx('project.overview.noTools')}</div>
      {/each}
    </div>
  </section>
</ProjectDashShell>
