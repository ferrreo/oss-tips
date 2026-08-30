<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import type { Goal, NavGroup, Project } from '../../fixtures/demo.js';
  import { demoGoals, demoProject, projectNavGroups, formatPercent } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraGoals } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatCurrency, formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export type GoalBasis = 'before fees' | 'active supporters';

  export interface GoalCreateInput {
    title: string;
    targetMajor: string;
    deadline: string;
    basis?: GoalBasis;
  }

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    goals?: Goal[];
    pageState?: 'ready' | 'error' | 'permission';
    onCreateGoal?: (input: GoalCreateInput) => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    goals = [...demoGoals, ...extraGoals],
    pageState = 'ready',
    onCreateGoal,
  }: Props = $props();

  let goalTitle = $state('Community illustration pack');
  let goalTarget = $state('2500');
  let goalDeadline = $state('2026-12-01');
  let goalBasis = $state<GoalBasis>('before fees');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  const rows = $derived(
    goals.map((goal) => {
      const isCountGoal =
        goal.type === 'supporter_count' ||
        goal.type === 'active_supporter_count' ||
        (!goal.type && goal.basis === 'active supporters');
      const progress = isCountGoal ? (goal.progressCount ?? goal.raisedMinor) : goal.raisedMinor;
      const target = isCountGoal ? (goal.targetCount ?? goal.targetMinor) : goal.targetMinor;
      return {
        title: goal.title,
        raised: isCountGoal
          ? formatNumber(progress, $locale)
          : formatCurrency(progress, goal.currency, $locale),
        target: isCountGoal
          ? formatNumber(target, $locale)
          : formatCurrency(target, goal.currency, $locale),
        percent: formatNumber(formatPercent(progress, target), $locale) + '%',
        basis: isCountGoal
          ? tx('project.goals.basisActiveSupporters')
          : tx('project.goals.basisBeforeFees'),
      };
    }),
  );

  async function createGoal() {
    if (!onCreateGoal || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onCreateGoal({
        title: goalTitle.trim(),
        targetMajor: goalTarget,
        deadline: goalDeadline,
        basis: goalBasis,
      });
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.goals.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.goals.title')}
  lede={tx('project.goals.lede')}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.goals.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.goals.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.goals.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.goals.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.between).class}>
      <p class={stylex.attrs(projectStyles.body).class}>{tx('project.goals.liveCount', { count: formatNumber(goals.length, $locale), project: project.name })}</p>
      <Button variant="primary" label={tx('project.goals.addButton')} loading={actionState === 'saving'} disabled={!onCreateGoal || actionState !== 'idle'} onclick={() => void createGoal()} />
    </div>
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="new-goal-heading">
      <h2 id="new-goal-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.goals.addHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField label={tx('project.goals.titleField')} bind:value={goalTitle} />
        <SegmentedControl
          label={tx('project.goals.basis')}
          options={[
            { value: 'before fees', label: tx('project.goals.basisBeforeFees') },
            { value: 'active supporters', label: tx('project.goals.basisActiveSupporters') },
          ]}
          bind:value={goalBasis}
        />
        <TextField
          label={tx('project.goals.targetField')}
          bind:value={goalTarget}
          type="number"
          inputmode={goalBasis === 'active supporters' ? 'numeric' : 'decimal'}
          help={tx('project.goals.targetHelp')}
        />
        <TextField label={tx('project.goals.deadlineField')} bind:value={goalDeadline} type="date" />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
      </div>
    </section>
    {#if goals.length > 0}
      <div class={stylex.attrs(projectStyles.stack, projectStyles.section).class}>
        {#each goals as goal (goal.id)}
          <GoalProgress {goal} />
        {/each}
      </div>
      <div class={stylex.attrs(projectStyles.section).class}>
        <Table
          caption={tx('project.goals.tableCaption', { project: project.name })}
          columns={[
            { key: 'title', label: tx('project.goals.goal') },
            { key: 'raised', label: tx('project.goals.raised') },
            { key: 'target', label: tx('project.goals.target') },
            { key: 'percent', label: tx('project.goals.progress') },
            { key: 'basis', label: tx('project.goals.basis') },
          ]}
          rows={rows}
        />
      </div>
    {:else}
      <div class={stylex.attrs(projectStyles.section).class}>
        <EmptyState title={tx('project.goals.emptyTitle')} description={tx('project.goals.emptyBody')} />
      </div>
    {/if}
  {/if}
</ProjectDashShell>
