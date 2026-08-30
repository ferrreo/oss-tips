<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { apiKeyRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    keys?: typeof apiKeyRows;
    pageState?: 'ready' | 'error' | 'permission';
    onCreateKey?: (input: { name: string; scopes: string }) => string | void | Promise<string | void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    keys = apiKeyRows,
    pageState = 'ready',
    onCreateKey,
  }: Props = $props();

  let keyName = $state('analytics-reader');
  let keyScopes = $state('project:read, analytics:read');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');
  let createdSecret = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const apiScopeKeys: Record<string, MessageKey> = {
    'project:read': 'project.apiKeys.scopeReadProject' as MessageKey,
    'analytics:read': 'project.apiKeys.scopeReadPayments' as MessageKey,
    'webhooks:manage': 'project.apiKeys.scopeWriteWebhooks' as MessageKey,
    'posts:read': 'project.apiKeys.scopeReadExports' as MessageKey,
    'supporters:read': 'project.apiKeys.scopeReadMemberships' as MessageKey,
  };
  const apiScopeLabel = (value: string) =>
    value
      .split(',')
      .map((part) => {
        const scope = part.trim();
        const key = apiScopeKeys[scope];
        return key ? tx(key) : scope;
      })
      .join(', ');
  const tableRows = $derived(
    keys.map((row) => ({
      ...row,
      created: row.createdAt ? formatDate(row.createdAt, $locale) : row.created,
      lastUsed: row.lastUsedAt ? formatDate(row.lastUsedAt, $locale) : row.lastUsed,
      scope: apiScopeLabel(row.scope),
    })),
  );

  async function createKey() {
    if (!onCreateKey || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    createdSecret = '';
    try {
      createdSecret = (await onCreateKey({ name: keyName.trim(), scopes: keyScopes })) ?? '';
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.apiKeys.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.apiKeys.title')}
  lede={tx('project.apiKeys.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.apiKeys.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.apiKeys.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.apiKeys.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.apiKeys.permissionBody')}</p>
    </div>
  {:else}
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface).class} aria-labelledby="new-key-heading">
      <h2 id="new-key-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.apiKeys.createHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField label={tx('project.apiKeys.name')} bind:value={keyName} help={tx('project.apiKeys.nameHelp')} />
        <TextField label={tx('project.apiKeys.scope')} bind:value={keyScopes} help={tx('project.apiKeys.scopeHelp')} />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {:else if createdSecret}
          <TextField label={tx('project.apiKeys.name')} value={createdSecret} disabled help={tx('project.apiKeys.nameHelp')} />
        {/if}
        <Button variant="primary" label={tx('project.apiKeys.createButton')} loading={actionState === 'saving'} disabled={!onCreateKey || actionState !== 'idle'} onclick={() => void createKey()} />
      </div>
    </section>
    {#if keys.length > 0}
      <div class={stylex.attrs(projectStyles.section).class}>
        <Table
          caption={tx('project.apiKeys.activeCaption', { project: project.name })}
          columns={[
            { key: 'name', label: tx('project.apiKeys.tableName') },
            { key: 'scope', label: tx('project.apiKeys.tableScope') },
            { key: 'created', label: tx('project.apiKeys.tableCreated') },
            { key: 'lastUsed', label: tx('project.apiKeys.tableLastUsed') },
          ]}
          rows={tableRows}
        />
      </div>
    {:else}
      <div class={stylex.attrs(projectStyles.section).class}>
        <EmptyState title={tx('project.apiKeys.emptyTitle')} description={tx('project.apiKeys.emptyBody')} />
      </div>
    {/if}
  {/if}
</ProjectDashShell>
