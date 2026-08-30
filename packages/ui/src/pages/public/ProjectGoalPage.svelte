<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import { demoProject, demoGoals, type Goal, type Project } from '../../fixtures/demo.js';
  import { formatCurrency, formatDate, formatNumber, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    project?: Project;
    goal?: Goal;
    goals?: Goal[];
    slug?: string;
    notes?: string[];
  }

  const defaultGoal = demoGoals.find((item) => item.slug === 'infrastructure-upgrade');
  if (!defaultGoal) throw new Error('Grove demo goal infrastructure-upgrade is missing');

  let {
    project = demoProject,
    goal: providedGoal,
    goals = demoGoals,
    slug = 'infrastructure-upgrade',
    notes,
  }: Props = $props();

  const goal = $derived(providedGoal ?? goals.find((item) => item.slug === slug) ?? defaultGoal);
  const isCountGoal = $derived(
    goal.type === 'supporter_count' ||
      goal.type === 'active_supporter_count' ||
      (!goal.type && goal.basis === 'active supporters'),
  );
  const progress = $derived(
    isCountGoal ? (goal.progressCount ?? goal.raisedMinor) : goal.raisedMinor,
  );
  const target = $derived(isCountGoal ? (goal.targetCount ?? goal.targetMinor) : goal.targetMinor);
  const remaining = $derived(Math.max(0, target - progress));
  const remainingLabel = $derived(
    isCountGoal ? formatNumber(remaining, $locale) : formatCurrency(remaining, goal.currency, $locale),
  );
  const deadlineLabel = $derived(
    goal.deadline && !Number.isNaN(Date.parse(goal.deadline))
      ? formatDate(goal.deadline, $locale)
      : goal.deadline ?? '',
  );
  const summary = $derived(
    goal.deadline
      ? t('public.goal.summaryWithDeadline', { amount: remainingLabel, date: deadlineLabel, basis: goal.basis }, $locale)
      : t('public.goal.summaryWithoutDeadline', { amount: remainingLabel, basis: goal.basis }, $locale),
  );
  const displayNotes = $derived(notes ?? [
    t('public.goal.noteSettled', {}, $locale),
    t('public.goal.noteTip', {}, $locale),
    t('public.goal.noteRefunds', {}, $locale),
  ]);
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/{project.slug}">{project.name}</a> / {t('public.goal.breadcrumb', {}, $locale)}</p>
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{goal.title}</h1>
      <p class={stylex.attrs(publicStyles.lead).class}>{goal.description}</p>
      <div class={stylex.attrs(publicStyles.section).class}>
        <GoalProgress {goal} headingLevel={2} />
      </div>
      <p>{summary}</p>
      <ul class={stylex.attrs(publicStyles.muted).class}>
        {#each displayNotes as note (note)}<li>{note}</li>{/each}
      </ul>
      <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href="/{project.slug}/support">{t('public.goal.support', {}, $locale)}</a>
    </div>
  {/snippet}
</PublicPageFrame>
