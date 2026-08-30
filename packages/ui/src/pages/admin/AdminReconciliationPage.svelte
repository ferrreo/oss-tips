<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import AdminTable from './AdminTable.svelte';
  import { formatCurrency, formatDate, formatNumber, locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { labelReconciliationStatus } from '../../lib/labels.js';
  import { admin } from '../../styles/admin.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import { adminNav, displayProject, reconciliationRows as defaultRows } from './admin-demo.js';
  import type { AdminReconciliationPageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin/reconciliation'),
    rows = defaultRows,
    state: pageState = 'ready',
  }: AdminReconciliationPageProps = $props();

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);
  const reconciliationStatusLabels: Record<string, string> = {
    aligned: 'admin.status.aligned',
    mismatch: 'admin.status.mismatch',
    pending: 'admin.status.pending',
  };
  const statusLabel = (value: string) => reconciliationStatusLabels[value] ? tt(reconciliationStatusLabels[value]!) : labelReconciliationStatus(value);

  const mismatches = $derived(rows.filter((row) => row.status === 'mismatch'));
  const pending = $derived(rows.filter((row) => row.status === 'pending'));
  const aligned = $derived(rows.filter((row) => row.status === 'aligned'));

  function deltaLabel(stripe: number, ledger: number, currency: string): string {
    const delta = stripe - ledger;
    if (delta === 0) return formatCurrency(0, currency, $locale);
    const sign = delta > 0 ? '+' : '−';
    return `${sign}${formatCurrency(Math.abs(delta), currency, $locale)}`;
  }

  const mismatchDeltaLabel = $derived.by(() => {
    if (mismatches.length === 0) return tt('admin.reconciliation.zeroDifference');
    const totals = new Map<string, number>();
    for (const row of mismatches) {
      const currency = row.currency.toUpperCase();
      totals.set(currency, (totals.get(currency) ?? 0) + row.stripeNetMinor - row.ledgerNetMinor);
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, delta]) => deltaLabel(delta, 0, currency))
      .join(', ');
  });
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.reconciliation')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.reconciliationContext')}
        detail={tt('admin.operator.reconciliationDetail')}
        tone={mismatches.length > 0 ? 'warning' : 'neutral'}
      />

      <StatusBanner
        variant={mismatches.length > 0 ? 'warning' : 'info'}
        title={tt('admin.reconciliation.mismatchTitle', { count: mismatches.length })}
        message={
          mismatches.length > 0
            ? tt('admin.reconciliation.mismatchMessage', { projects: mismatches.map((row) => displayProject(row.project)).join(', '), delta: mismatchDeltaLabel })
            : tt('admin.reconciliation.alignedMessage')
        }
      />

      <div {...stylex.attrs(admin.grid3)}>
        <DataCard label={tt('admin.reconciliation.alignedDays')} value={formatNumber(aligned.length, $locale)} compare={tt('admin.reconciliation.zeroDifference')} />
        <DataCard
          label={tt('admin.reconciliation.mismatches')}
          value={formatNumber(mismatches.length, $locale)}
          compare={mismatchDeltaLabel}
          compareDirection="down"
        />
        <DataCard label={tt('admin.reconciliation.pendingLedger')} value={formatNumber(pending.length, $locale)} compare={tt('admin.reconciliation.stripeSeen')} />
      </div>

      <div {...stylex.attrs(admin.tableWrap)}>
        <AdminTable
          caption={tt('admin.reconciliation.dailyCaption')}
          columns={[
            { key: 'date', label: tt('admin.reconciliation.date') },
            { key: 'project', label: tt('admin.reconciliation.project') },
            { key: 'stripe', label: tt('admin.reconciliation.stripeNet') },
            { key: 'ledger', label: tt('admin.reconciliation.ledgerNet') },
            { key: 'delta', label: tt('admin.reconciliation.difference') },
            { key: 'status', label: tt('admin.reconciliation.status') },
          ]}
          rows={rows.map((row) => ({
            date: formatDate(row.date, $locale, { dateStyle: 'medium' }),
            project: displayProject(row.project),
            stripe: formatCurrency(row.stripeNetMinor, row.currency, $locale),
            ledger: row.status === 'pending' ? tt('admin.reconciliation.notPosted') : formatCurrency(row.ledgerNetMinor, row.currency, $locale),
            delta: row.status === 'pending' ? statusLabel('pending') : deltaLabel(row.stripeNetMinor, row.ledgerNetMinor, row.currency),
            status: statusLabel(row.status),
          }))}
        />
      </div>

      <section {...stylex.attrs(admin.section)}>
        <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.reconciliation.openDifferences')}</h2>
        <div {...stylex.attrs(admin.tableWrap)}>
          <AdminTable
            caption={tt('admin.reconciliation.openCaption')}
            columns={[
              { key: 'date', label: tt('admin.reconciliation.date') },
              { key: 'project', label: tt('admin.reconciliation.project') },
              { key: 'difference', label: tt('admin.reconciliation.whatDiffers') },
              { key: 'next', label: tt('admin.reconciliation.nextStep') },
            ]}
            rows={mismatches.concat(pending).map((row) => ({
              date: formatDate(row.date, $locale, { dateStyle: 'medium' }),
              project: displayProject(row.project),
              difference:
                row.status === 'pending'
                  ? tt('admin.reconciliation.pendingDifference', { stripe: formatCurrency(row.stripeNetMinor, row.currency, $locale) })
                  : tt('admin.reconciliation.mismatchDifference', { stripe: formatCurrency(row.stripeNetMinor, row.currency, $locale), ledger: formatCurrency(row.ledgerNetMinor, row.currency, $locale), delta: deltaLabel(row.stripeNetMinor, row.ledgerNetMinor, row.currency) }),
              next:
                row.status === 'pending'
                  ? tt('admin.reconciliation.pendingNext')
                  : tt('admin.reconciliation.mismatchNext'),
            }))}
          />
        </div>
      </section>
    </div>
  {/if}
</AdminShell>
