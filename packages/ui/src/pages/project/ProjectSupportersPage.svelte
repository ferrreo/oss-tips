<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Table from '../../components/Table.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { NavGroup, Project, Supporter } from '../../fixtures/demo.js';
  import { demoProject, demoSupporters, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import type { RankedSupporter } from './project-demo.js';
  import { rankedSupporters } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatCurrency, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    supporters?: Supporter[];
    rankings?: RankedSupporter[];
    pageState?: 'ready' | 'error' | 'permission';
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    supporters = demoSupporters,
    rankings = rankedSupporters,
    pageState = 'ready',
  }: Props = $props();

  let search = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const cadenceLabel = (value: string) =>
    value === 'one-off' || value === 'one_off'
      ? tx('common.oneOff')
      : value === 'annual' || value === 'yearly'
        ? tx('common.annual')
        : tx('common.monthly');
  const visibleSupporters = $derived(
    supporters.filter((supporter) => {
      const query = search.trim().toLowerCase();
      return !query || `${supporter.displayName} ${supporter.handle}`.toLowerCase().includes(query);
    }),
  );
  const allRows = $derived(
    visibleSupporters.map((supporter) => ({
      name: supporter.displayName,
      cadence: supporter.cadence ? cadenceLabel(supporter.cadence) : '—',
      amount: supporter.amountMinor ? formatCurrency(supporter.amountMinor, project.currency, $locale) : '—',
      public: supporter.public ? tx('project.supporters.yes') : tx('project.supporters.private'),
    })),
  );
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.supporters.title')}
  lede={tx('project.supporters.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.supporters.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.supporters.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.supporters.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.supporters.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.surface, projectStyles.formSurface).class}>
      <TextField label={tx('project.supporters.search')} bind:value={search} placeholder={tx('project.supporters.searchPlaceholder')} type="search" />
    </div>
    <div class={stylex.attrs(projectStyles.section).class}>
      <SupporterWall supporters={visibleSupporters} currency={project.currency} />
    </div>
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.supporters.topHeading')}</h2>
    {#if rankings.length > 0}
      <Table
        caption={tx('project.supporters.rankCaption')}
        columns={[
          { key: 'rank', label: tx('project.supporters.rank') },
          { key: 'name', label: tx('project.supporters.name') },
          { key: 'cadence', label: tx('project.supporters.cadence') },
          { key: 'amount', label: tx('project.supporters.amount') },
        ]}
        rows={rankings.map((supporter) => ({
          rank: String(supporter.rank),
          name: supporter.name,
          cadence: cadenceLabel(supporter.cadence),
          amount: supporter.amountMinor !== undefined ? formatCurrency(supporter.amountMinor, supporter.currency ?? project.currency, $locale) : supporter.amount,
        }))}
      />
    {:else}
      <EmptyState title={tx('project.supporters.noRankingsTitle')} description={tx('project.supporters.noRankingsBody')} />
    {/if}
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.supporters.allHeading')}</h2>
    {#if allRows.length > 0}
      <Table
        caption={tx('project.supporters.allCaption', { project: project.name })}
        columns={[
          { key: 'name', label: tx('project.supporters.displayName') },
          { key: 'cadence', label: tx('project.supporters.cadence') },
          { key: 'amount', label: tx('project.supporters.amount') },
          { key: 'public', label: tx('project.supporters.public') },
        ]}
        rows={allRows}
      />
    {:else}
      <EmptyState title={tx('project.supporters.noSupportersTitle')} description={tx('project.supporters.noSupportersBody')} />
    {/if}
  {/if}
</ProjectDashShell>
