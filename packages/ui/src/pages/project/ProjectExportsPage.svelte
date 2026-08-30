<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { exportRows, type ExportPreviewRow } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    exports?: ExportPreviewRow[];
    pageState?: 'ready' | 'error' | 'permission';
    onRequestExport?: (input: { kind: 'supporters' | 'payments' | 'memberships'; format: 'csv' | 'json' }) => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    exports = exportRows,
    pageState = 'ready',
    onRequestExport,
  }: Props = $props();

  let exportKind = $state<'supporters' | 'payments' | 'memberships'>('payments');
  let exportFormat = $state<'csv' | 'json'>('csv');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  const exportTypeLabel = (value: string) =>
    ({
      payments: tx('project.payments.title'),
      memberships: tx('project.memberships.title'),
      supporters: tx('project.supporters.title'),
    })[value.toLowerCase()] ?? value;

  const exportStatusLabel = (value: string) =>
    ({
      ready: tx('project.exports.ready'),
      pending: tx('project.exports.pending'),
      queued: tx('project.exports.pending'),
      processing: tx('project.exports.pending'),
      failed: tx('project.exports.failed'),
      expired: tx('project.exports.expired'),
    })[value.toLowerCase()] ?? value;

  const exportTableRows = $derived(
    exports.map((item) => ({
      type: exportTypeLabel(item.type),
      range: item.range,
      format: item.format,
      status: exportStatusLabel(item.status),
      expires: item.expiresAt ? formatDate(item.expiresAt, $locale) : '—',
      download: item.downloadUrl
        ? { label: tx('project.exports.download'), href: item.downloadUrl }
        : '—',
    })),
  );

  async function requestExport() {
    if (!onRequestExport || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onRequestExport({ kind: exportKind, format: exportFormat });
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.exports.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.exports.title')}
  lede={tx('project.exports.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.exports.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.exports.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.exports.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.exports.permissionBody')}</p>
    </div>
  {:else}
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface).class} aria-labelledby="export-request-heading">
      <h2 id="export-request-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.exports.requestHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <SegmentedControl
          label={tx('project.exports.type')}
          options={[{ value: 'payments', label: tx('project.payments.title') }, { value: 'memberships', label: tx('project.memberships.title') }, { value: 'supporters', label: tx('project.supporters.title') }]}
          bind:value={exportKind}
        />
        <SegmentedControl
          label={tx('project.exports.format')}
          options={[{ value: 'csv', label: tx('project.exports.format') + ': CSV' }, { value: 'json', label: tx('project.exports.format') + ': JSON' }]}
          bind:value={exportFormat}
        />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
        <Button variant="secondary" label={tx('project.exports.requestButton')} loading={actionState === 'saving'} disabled={!onRequestExport || actionState !== 'idle'} onclick={() => void requestExport()} />
      </div>
    </section>
    <div class={stylex.attrs(projectStyles.section).class}>
      {#if exports.length > 0}
        <Table
          caption={tx('project.exports.availableCaption')}
          columns={[
            { key: 'type', label: tx('project.exports.type') },
            { key: 'range', label: tx('project.exports.range') },
            { key: 'format', label: tx('project.exports.format') },
            { key: 'status', label: tx('project.exports.status') },
            { key: 'expires', label: tx('project.exports.availableUntil') },
            { key: 'download', label: tx('project.exports.action') },
          ]}
          rows={exportTableRows}
        />
      {:else}
        <EmptyState title={tx('project.exports.emptyTitle')} description={tx('project.exports.emptyBody')} />
      {/if}
    </div>
  {/if}
</ProjectDashShell>
