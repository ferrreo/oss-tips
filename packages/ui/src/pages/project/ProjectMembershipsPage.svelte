<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import TierCard from '../../components/TierCard.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { NavGroup, Project, Tier } from '../../fixtures/demo.js';
  import { demoProject, demoTiers, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { membershipRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatCurrency, formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface TierCreateInput {
    name: string;
    monthlyMajor: string;
    rewards: string;
  }

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    tiers?: Tier[];
    memberships?: typeof membershipRows;
    pageState?: 'ready' | 'error' | 'permission';
    onCreateTier?: (input: TierCreateInput) => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    tiers = demoTiers,
    memberships = membershipRows,
    pageState = 'ready',
    onCreateTier,
  }: Props = $props();

  let tierName = $state('Patron');
  let monthlyAmount = $state('40');
  let rewards = $state('Champion rewards, private office hours');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const cadenceLabel = (value: string) =>
    value === 'one-off' || value === 'one_off'
      ? tx('common.oneOff')
      : value === 'annual' || value === 'yearly'
        ? tx('common.annual')
        : tx('common.monthly');
  const membershipStatusLabel = (value: string) =>
    ({ active: tx('project.memberships.active'), past_due: tx('project.memberships.pastDue'), cancelled: tx('project.memberships.cancelled'), canceled: tx('project.memberships.cancelled'), entitled: tx('project.memberships.entitled') })[value] ?? value;
  const tableRows = $derived(
    memberships.map((row) => ({
      ...row,
      cadence: cadenceLabel(row.cadence),
      amount: row.amountMinor !== undefined ? formatCurrency(row.amountMinor, row.currency ?? project.currency, $locale) : row.amount,
      status: membershipStatusLabel(row.status),
      renews: row.renewsAt ? formatDate(row.renewsAt, $locale) : row.renews,
    })),
  );

  async function createTier() {
    if (!onCreateTier || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onCreateTier({ name: tierName.trim(), monthlyMajor: monthlyAmount, rewards });
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.memberships.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.memberships.title')}
  lede={tx('project.memberships.lede')}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.memberships.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.memberships.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.memberships.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.memberships.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.between).class}>
      <p class={stylex.attrs(projectStyles.body).class}>{tx('project.memberships.available', { count: tiers.length })}</p>
      <Button variant="primary" label={tx('project.memberships.addButton')} loading={actionState === 'saving'} disabled={!onCreateTier || actionState !== 'idle'} onclick={() => void createTier()} />
    </div>
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="new-tier-heading">
      <h2 id="new-tier-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.memberships.addHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField label={tx('project.memberships.name')} bind:value={tierName} />
        <TextField label={tx('project.memberships.monthly')} bind:value={monthlyAmount} type="number" inputmode="decimal" />
        <TextField label={tx('project.memberships.rewards')} bind:value={rewards} />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
      </div>
    </section>
    {#if tiers.length > 0}
      <div class={stylex.attrs(projectStyles.grid3, projectStyles.responsiveGrid3, projectStyles.section).class}>
        {#each tiers as tier (tier.id)}
          <TierCard {tier} currency={project.currency} />
        {/each}
      </div>
    {:else}
      <div class={stylex.attrs(projectStyles.section).class}>
        <EmptyState title={tx('project.memberships.emptyTiersTitle')} description={tx('project.memberships.emptyTiersBody')} />
      </div>
    {/if}
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.memberships.activeHeading')}</h2>
    {#if memberships.length > 0}
      <Table
        caption={tx('project.memberships.caption', { project: project.name })}
        columns={[
          { key: 'name', label: tx('project.memberships.supporter') },
          { key: 'tier', label: tx('project.memberships.tier') },
          { key: 'cadence', label: tx('project.memberships.cadence') },
          { key: 'amount', label: tx('project.memberships.amount') },
          { key: 'status', label: tx('project.memberships.status') },
          { key: 'renews', label: tx('project.memberships.renews') },
        ]}
        rows={tableRows}
      />
    {:else}
      <EmptyState title={tx('project.memberships.emptyMembershipsTitle')} description={tx('project.memberships.emptyMembershipsBody')} />
    {/if}
  {/if}
</ProjectDashShell>
