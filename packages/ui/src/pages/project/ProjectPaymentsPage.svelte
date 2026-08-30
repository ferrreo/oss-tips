<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import type { NavGroup, Payment, Project } from '../../fixtures/demo.js';
  import { demoPayments, demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPayments } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatCurrency, formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    payments?: Payment[];
    pageState?: 'ready' | 'error' | 'permission';
    onExport?: () => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    payments = [...demoPayments, ...extraPayments],
    pageState = 'ready',
    onExport,
  }: Props = $props();

  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  const settledTotal = $derived(
    payments.filter((payment) => payment.status === 'succeeded').reduce((total, payment) => total + payment.amountMinor, 0),
  );
  const pendingTotal = $derived(
    payments.filter((payment) => payment.status === 'pending').reduce((total, payment) => total + payment.amountMinor, 0),
  );
  const exceptionTotal = $derived(
    payments.filter((payment) => payment.status === 'failed' || payment.status === 'refunded').reduce((total, payment) => total + payment.amountMinor, 0),
  );
  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const cadenceLabel = (value: string) =>
    value === 'one-off' || value === 'one_off'
      ? tx('common.oneOff')
      : value === 'annual' || value === 'yearly'
        ? tx('common.annual')
        : tx('common.monthly');
  const paymentStatusLabel = (value: string) =>
    ({ succeeded: tx('project.payments.succeeded'), paid: tx('project.payments.paid'), pending: tx('project.payments.pending'), processing: tx('project.payments.processing'), failed: tx('project.payments.failed'), refunded: tx('project.payments.refunded') })[value] ?? value;

  async function exportPayments() {
    if (!onExport || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onExport();
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.payments.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.payments.title')}
  lede={tx('project.payments.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.payments.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.payments.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.payments.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.payments.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.grid3, projectStyles.responsiveGrid3).class}>
      <DataCard label={tx('project.payments.settled')} value={formatCurrency(settledTotal, project.currency, $locale)} compare={tx('project.payments.settledLabel')} compareDirection="up" />
      <DataCard label={tx('project.payments.pending')} value={formatCurrency(pendingTotal, project.currency, $locale)} compare={tx('project.payments.awaitingSettlement')} />
      <DataCard label={tx('project.payments.failedRefunded')} value={formatCurrency(exceptionTotal, project.currency, $locale)} compare={tx('project.payments.needsReview')} compareDirection="down" />
    </div>
    <div class={stylex.attrs(projectStyles.between, projectStyles.section).class}>
      <p class={stylex.attrs(projectStyles.body).class}><bdi>{tx('project.payments.chargesCount', { count: formatNumber(payments.length, $locale) })}</bdi></p>
      <Button variant="secondary" label={tx('project.payments.exportButton')} loading={actionState === 'saving'} disabled={!onExport || actionState !== 'idle'} onclick={() => void exportPayments()} />
    </div>
    {#if actionError}
      <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
    {/if}
    {#if payments.length > 0}
      <Table
        caption={tx('project.payments.caption', { project: project.name })}
        columns={[
          { key: 'date', label: tx('project.payments.date') },
          { key: 'supporter', label: tx('project.payments.supporter') },
          { key: 'amount', label: tx('project.payments.amount') },
          { key: 'cadence', label: tx('project.payments.cadence') },
          { key: 'status', label: tx('project.payments.status') },
        ]}
        rows={payments.map((payment) => ({
          date: formatDate(payment.date, $locale),
          supporter: payment.supporter,
          amount: formatCurrency(payment.amountMinor, payment.currency, $locale),
          cadence: cadenceLabel(payment.cadence),
          status: paymentStatusLabel(payment.status),
        }))}
      />
    {:else}
      <EmptyState title={tx('project.payments.emptyTitle')} description={tx('project.payments.emptyBody')} />
    {/if}
  {/if}
</ProjectDashShell>
