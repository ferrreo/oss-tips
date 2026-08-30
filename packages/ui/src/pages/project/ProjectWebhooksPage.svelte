<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { webhookDeliveries, webhookRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    endpoints?: typeof webhookRows;
    deliveries?: typeof webhookDeliveries;
    pageState?: 'ready' | 'error' | 'permission';
    onCreateEndpoint?: (input: { url: string; events: string }) => string | void | Promise<string | void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    endpoints = webhookRows,
    deliveries = webhookDeliveries,
    pageState = 'ready',
    onCreateEndpoint,
  }: Props = $props();

  let endpointUrl = $state('https://api.grove.dev/hooks');
  let endpointEvents = $state('support.succeeded, membership.started, membership.cancelled');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');
  let createdSecret = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const endpointRows = $derived(
    endpoints.map((endpoint) => ({
      ...endpoint,
      last: endpoint.lastAt ? formatDate(endpoint.lastAt, $locale) : endpoint.last,
    })),
  );
  const deliveryRows = $derived(
    deliveries.map((delivery) => ({
      ...delivery,
      time: delivery.timeAt ? formatDate(delivery.timeAt, $locale) : delivery.time,
    })),
  );

  async function createEndpoint() {
    if (!onCreateEndpoint || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    createdSecret = '';
    try {
      createdSecret = (await onCreateEndpoint({ url: endpointUrl.trim(), events: endpointEvents })) ?? '';
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.webhooks.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.webhooks.title')}
  lede={tx('project.webhooks.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.webhooks.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.webhooks.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.webhooks.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.webhooks.permissionBody')}</p>
    </div>
  {:else}
    {#if endpoints.some((endpoint) => endpoint.status !== 'Active')}
      <StatusBanner
        variant="warning"
        title={tx('project.webhooks.attention')}
        message={tx('project.webhooks.attentionBody')}
      />
    {/if}
    <div class={stylex.attrs(projectStyles.between, projectStyles.section).class}>
      <p class={stylex.attrs(projectStyles.body).class}>{tx('project.webhooks.endpointCount', { count: formatNumber(endpoints.length, $locale) })}</p>
      <Button variant="primary" label={tx('project.webhooks.add')} loading={actionState === 'saving'} disabled={!onCreateEndpoint || actionState !== 'idle'} onclick={() => void createEndpoint()} />
    </div>
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="new-endpoint-heading">
      <h2 id="new-endpoint-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.webhooks.addHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField label={tx('project.webhooks.url')} bind:value={endpointUrl} type="text" inputmode="url" />
        <TextField label={tx('project.webhooks.events')} bind:value={endpointEvents} help={tx('project.webhooks.eventsHelp')} />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {:else if createdSecret}
          <TextField label={tx('project.webhooks.events')} value={createdSecret} disabled help={tx('project.webhooks.eventsHelp')} />
        {/if}
      </div>
    </section>
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.webhooks.registeredHeading')}</h2>
    {#if endpoints.length > 0}
      <Table
        caption={tx('project.webhooks.registeredCaption')}
        columns={[
          { key: 'url', label: tx('project.webhooks.urlColumn') },
          { key: 'events', label: tx('project.webhooks.eventsColumn') },
          { key: 'status', label: tx('project.webhooks.statusColumn') },
          { key: 'last', label: tx('project.webhooks.lastDelivery') },
        ]}
        rows={endpointRows}
      />
    {:else}
      <EmptyState title={tx('project.webhooks.emptyEndpointsTitle')} description={tx('project.webhooks.emptyEndpointsBody')} />
    {/if}
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.webhooks.deliveriesHeading')}</h2>
    {#if deliveries.length > 0}
      <Table
        caption={tx('project.webhooks.deliveriesCaption')}
        columns={[
          { key: 'id', label: tx('project.webhooks.delivery') },
          { key: 'event', label: tx('project.webhooks.event') },
          { key: 'target', label: tx('project.webhooks.target') },
          { key: 'code', label: tx('project.webhooks.statusColumn') },
          { key: 'time', label: tx('project.webhooks.when') },
        ]}
        rows={deliveryRows}
      />
    {:else}
      <EmptyState title={tx('project.webhooks.emptyDeliveriesTitle')} description={tx('project.webhooks.emptyDeliveriesBody')} />
    {/if}
  {/if}
</ProjectDashShell>
