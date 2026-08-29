<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import type { Goal } from '../fixtures/demo.js';
  import { formatMoney, formatPercent } from '../fixtures/demo.js';

  interface Props {
    goal: Goal;
  }

  let { goal }: Props = $props();

  const percent = formatPercent(goal.raisedMinor, goal.targetMinor);
</script>

<article class="pl-goal">
  <div class="pl-goal__header">
    <h3 style="font-size: 1.125rem;">{goal.title}</h3>
    <span class="pl-goal__amount">{percent}%</span>
  </div>
  <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;">{goal.description}</p>
  <ProgressBar value={percent} label={`${percent}% of goal reached`} />
  <div class="pl-row pl-row--between" style="margin-top: 0.75rem; font-size: 0.875rem;">
    <span>
      <strong>{formatMoney(goal.raisedMinor, goal.currency)}</strong>
      <span class="pl-muted"> raised of {formatMoney(goal.targetMinor, goal.currency)}</span>
    </span>
    {#if goal.deadline}
      <span class="pl-muted">Deadline {goal.deadline}</span>
    {/if}
  </div>
  <p class="pl-muted" style="font-size: 0.75rem; margin-top: 0.5rem;">Basis: {goal.basis}</p>
  <span class="pl-fern" aria-hidden="true" style="display: block; margin-top: 0.5rem; font-size: 0.75rem; color: var(--pl-fern);">◦ ◦ ◦</span>
</article>
