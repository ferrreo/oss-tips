<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import type { Goal } from '../fixtures/demo.js';
  import { formatMoney, formatPercent } from '../fixtures/demo.js';

  interface Props {
    goal: Goal;
  }

  let { goal }: Props = $props();

  const percent = $derived(formatPercent(goal.raisedMinor, goal.targetMinor));
</script>

<article class="pl-goal">
  <div class="pl-goal__header">
    <div>
      <p class="pl-goal__overline">Goal</p>
      <h3 class="pl-goal__title">{goal.title}</h3>
    </div>
    <span class="pl-goal__amount">{percent}%</span>
  </div>
  <p class="pl-goal__desc">{goal.description}</p>
  <ProgressBar value={percent} label={`${percent}% of goal reached`} />
  <div class="pl-goal__meta">
    <span>
      <strong class="pl-goal__raised">{formatMoney(goal.raisedMinor, goal.currency)}</strong>
      <span class="pl-muted"> raised of {formatMoney(goal.targetMinor, goal.currency)}</span>
    </span>
    {#if goal.deadline}
      <span class="pl-muted">Deadline {goal.deadline}</span>
    {/if}
  </div>
  <p class="pl-goal__basis">Basis: {goal.basis}</p>
  <svg class="pl-goal__botanical" viewBox="0 0 48 16" aria-hidden="true">
    <path d="M8 12 C12 4 20 4 24 12" fill="none" stroke="var(--pl-fern)" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M24 12 C28 5 34 6 36 11 C32 12 28 12 24 12 Z" fill="var(--pl-moss)" opacity="0.7"/>
    <path d="M30 11 C34 7 40 8 39 13 C35 13 32 12 30 11 Z" fill="var(--pl-ochre)" opacity="0.7"/>
    <circle cx="24" cy="12.5" r="1.4" fill="var(--pl-ink)"/>
  </svg>
</article>
