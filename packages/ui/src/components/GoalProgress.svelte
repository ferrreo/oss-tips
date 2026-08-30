<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import type { Goal } from '../fixtures/demo.js';
  import { formatCurrency, formatDate, formatNumber, locale, t } from '../lib/i18n.js';
  import { attrs, display } from '../styles/display.stylex.js';

  export interface Props {
    goal: Goal;
    headingLevel?: 2 | 3;
  }

  let { goal, headingLevel = 3 }: Props = $props();

  const isCountGoal = $derived(
    goal.type === 'supporter_count' ||
      goal.type === 'active_supporter_count' ||
      (!goal.type && goal.basis === 'active supporters'),
  );
  const progress = $derived(
    isCountGoal ? (goal.progressCount ?? goal.raisedMinor) : goal.raisedMinor,
  );
  const target = $derived(isCountGoal ? (goal.targetCount ?? goal.targetMinor) : goal.targetMinor);
  const percent = $derived(target <= 0 ? 0 : Math.min(100, Math.round((progress / target) * 100)));
  const cardAttrs = attrs(display.goal);
  const headerAttrs = attrs(display.goalHeader);
  const overlineAttrs = attrs(display.goalOverline);
  const titleAttrs = attrs(display.goalTitle);
  const amountAttrs = attrs(display.goalAmount);
  const descriptionAttrs = attrs(display.goalDescription);
  const metaAttrs = attrs(display.goalMeta);
  const raisedAttrs = attrs(display.goalRaised);
  const mutedAttrs = attrs(display.goalMuted);
  const basisAttrs = attrs(display.goalBasis);
  const botanicalAttrs = attrs(display.goalBotanical);
  const stemAttrs = attrs(display.goalBotanicalStem);
  const mossAttrs = attrs(display.goalBotanicalMoss);
  const ochreAttrs = attrs(display.goalBotanicalOchre);
  const nodeAttrs = attrs(display.goalBotanicalNode);
  const titleTag = $derived(headingLevel === 2 ? 'h2' : 'h3');
</script>

<article class={cardAttrs.class} style={cardAttrs.style}>
  <div class={headerAttrs.class} style={headerAttrs.style}>
    <div>
      <p class={overlineAttrs.class} style={overlineAttrs.style}>{t('common.goal', {}, $locale)}</p>
      <svelte:element this={titleTag} class={titleAttrs.class} style={titleAttrs.style}>{goal.title}</svelte:element>
    </div>
    <span class={amountAttrs.class} style={amountAttrs.style}>{formatNumber(percent, $locale)}%</span>
  </div>
  <p class={descriptionAttrs.class} style={descriptionAttrs.style}>{goal.description}</p>
  <ProgressBar value={percent} label={`${formatNumber(percent, $locale)}% ${t('common.progress', {}, $locale)}`} />
  <div class={metaAttrs.class} style={metaAttrs.style}>
    <span>
      <strong class={raisedAttrs.class} style={raisedAttrs.style}>{isCountGoal ? formatNumber(progress, $locale) : formatCurrency(progress, goal.currency, $locale)}</strong>
      <span class={mutedAttrs.class} style={mutedAttrs.style}> {t('common.raisedOf', {}, $locale)} {isCountGoal ? formatNumber(target, $locale) : formatCurrency(target, goal.currency, $locale)}</span>
    </span>
    {#if goal.deadline}
      <span class={mutedAttrs.class} style={mutedAttrs.style}>{t('common.deadline', {}, $locale)} {formatDate(goal.deadline, $locale)}</span>
    {/if}
  </div>
  <p class={basisAttrs.class} style={basisAttrs.style}>{t('common.basis', {}, $locale)} {goal.basis}</p>
  <svg class={botanicalAttrs.class} style={botanicalAttrs.style} viewBox="0 0 48 16" aria-hidden="true">
    <path {...stemAttrs} d="M8 12 C12 4 20 4 24 12" />
    <path {...mossAttrs} d="M24 12 C28 5 34 6 36 11 C32 12 28 12 24 12 Z" />
    <path {...ochreAttrs} d="M30 11 C34 7 40 8 39 13 C35 13 32 12 30 11 Z" />
    <circle {...nodeAttrs} cx="24" cy="12.5" r="1.4" />
  </svg>
</article>
