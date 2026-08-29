<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoProject, demoGoals, projectNavGroups } from '../../fixtures/demo.js';
  import SupportOverTimeChart from './SupportOverTimeChart.svelte';
  import {
    inboxPreviewRows,
    overviewMetrics,
    rankedSupporters,
    supportOverTimeLabels,
    supportOverTimeSeries,
    toolCards,
  } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Overview">
  <StatusBanner
    variant="warning"
    title="Stripe verification incomplete"
    message="Payments disabled until charges_enabled is active."
  />

  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    {#each overviewMetrics as metric (metric.label)}
      <DataCard
        label={metric.label}
        value={metric.value}
        compare={metric.compare}
        compareDirection={metric.compareDirection}
      />
    {/each}
  </div>

  <SupportOverTimeChart
    title="Support over time"
    range="Last 12 months · Europe/London"
    labels={supportOverTimeLabels}
    series={supportOverTimeSeries}
    valuePrefix="$"
  />

  <div class="pl-grid-2" style="margin-top: 1.5rem;">
    <section class="pl-surface" style="padding: 1.25rem;">
      <div class="pl-row pl-row--between" style="margin-bottom: 0.75rem;">
        <h2 class="pl-display" style="font-size: 1.125rem;">Supporter inbox</h2>
        <span class="pl-badge pl-badge--forest">3 unread</span>
      </div>
      <ul style="list-style: none; margin: 0; padding: 0;">
        {#each inboxPreviewRows as row (row.id)}
          <li
            style="display: grid; grid-template-columns: 2.25rem 1fr auto auto; gap: 0.75rem; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid var(--pl-border);"
          >
            <span
              aria-hidden="true"
              style="width: 2.25rem; height: 2.25rem; border-radius: 999px; background: var(--pl-canvas-subtle); border: 1px solid var(--pl-border); display: flex; align-items: center; justify-content: center; font-family: var(--pl-font-display); color: var(--pl-forest);"
            >
              {row.initial}
            </span>
            <div style="min-width: 0;">
              <div class="pl-row" style="gap: 0.4rem;">
                <strong style="font-size: 0.875rem;">{row.name}</strong>
                {#if row.unread}
                  <span class="pl-badge pl-badge--forest">new</span>
                {/if}
              </div>
              <p class="pl-muted" style="margin: 0.15rem 0 0; font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                {row.snippet}
              </p>
            </div>
            <span style="font-variant-numeric: tabular-nums; font-weight: 600; font-size: 0.875rem;">{row.amount}</span>
            <time class="pl-muted" style="font-size: 0.75rem;">{row.time}</time>
          </li>
        {/each}
      </ul>
    </section>

    <section class="pl-stack">
      <h2 class="pl-display" style="font-size: 1.125rem;">Goal progress</h2>
      {#each demoGoals as goal (goal.id)}
        <GoalProgress {goal} />
      {/each}
    </section>
  </div>

  <section class="pl-surface" style="padding: 1.25rem; margin-top: 1.5rem;">
    <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Top supporters</h2>
    <ol style="list-style: none; margin: 0; padding: 0;">
      {#each rankedSupporters as supporter (supporter.rank)}
        <li
          class="pl-row pl-row--between"
          style="padding: 0.65rem 0; border-bottom: 1px solid var(--pl-border);"
        >
          <div class="pl-row">
            <span class="pl-muted" style="width: 1.5rem; font-variant-numeric: tabular-nums;">{supporter.rank}</span>
            <span
              aria-hidden="true"
              style="width: 2rem; height: 2rem; border-radius: 999px; background: var(--pl-canvas-subtle); border: 1px solid var(--pl-border); display: flex; align-items: center; justify-content: center; font-family: var(--pl-font-display); color: var(--pl-forest);"
            >
              {supporter.initial}
            </span>
            <div>
              <strong style="font-size: 0.875rem;">{supporter.name}</strong>
              <div class="pl-muted" style="font-size: 0.75rem;">{supporter.cadence}</div>
            </div>
          </div>
          <span style="font-variant-numeric: tabular-nums; font-weight: 600;">{supporter.amount}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section style="margin-top: 1.5rem;">
    <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Tools</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr)); gap: 1rem;">
      {#each toolCards as tool (tool.title)}
        <article class="pl-surface" style="padding: 1.15rem; display: flex; flex-direction: column; gap: 0.6rem;">
          <h3 style="font-size: 1.05rem;">{tool.title}</h3>
          <p class="pl-muted" style="margin: 0; font-size: 0.8125rem; flex: 1;">{tool.blurb}</p>
          <Button variant="secondary">Manage</Button>
        </article>
      {/each}
    </div>
  </section>
</DashboardShell>
