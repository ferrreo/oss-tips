<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { adminNav, displayProject, formatMoney, humanizeStatus, reconciliationRows } from './admin-demo.js';

  const mismatches = reconciliationRows.filter((r) => r.status === 'mismatch');
  const pending = reconciliationRows.filter((r) => r.status === 'pending');
  const aligned = reconciliationRows.filter((r) => r.status === 'aligned');

  const mismatchDeltaMinor = mismatches.reduce((sum, r) => sum + (r.stripeNetMinor - r.ledgerNetMinor), 0);

  function deltaLabel(stripe: number, ledger: number): string {
    const delta = stripe - ledger;
    if (delta === 0) return '£0.00';
    const sign = delta > 0 ? '+' : '−';
    return `${sign}${formatMoney(Math.abs(delta))}`;
  }
</script>

<AdminShell navGroups={adminNav('/admin/reconciliation')} title="Reconciliation">
  <AdminOperatorBar
    context="Stripe balance transactions against the oss.tips ledger"
    detail="Leave a difference open until there is a posting or a written timing window. Do not force a match without a reason."
  />

  <StatusBanner
    variant="warning"
    title="{mismatches.length} settlement mismatches"
    message="Stripe net and ledger net differ on {mismatches.map((r) => displayProject(r.project)).join(', ')}. Combined Stripe-minus-ledger delta is {deltaLabel(mismatchDeltaMinor, 0)}."
  />

  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="Aligned days" value={String(aligned.length)} compare="Zero difference" />
    <DataCard
      label="Mismatches"
      value={String(mismatches.length)}
      compare={deltaLabel(mismatchDeltaMinor, 0)}
      compareDirection="down"
    />
    <DataCard label="Pending ledger" value={String(pending.length)} compare="Stripe seen, not posted" />
  </div>

  <Table
    caption="Daily net by project. Difference is Stripe net minus ledger net."
    columns={[
      { key: 'date', label: 'Date' },
      { key: 'project', label: 'Project' },
      { key: 'stripe', label: 'Stripe net' },
      { key: 'ledger', label: 'Ledger net' },
      { key: 'delta', label: 'Difference' },
      { key: 'status', label: 'Status' },
    ]}
    rows={reconciliationRows.map((r) => ({
      date: r.date,
      project: displayProject(r.project),
      stripe: formatMoney(r.stripeNetMinor),
      ledger: r.status === 'pending' ? 'Not posted' : formatMoney(r.ledgerNetMinor),
      delta: r.status === 'pending' ? humanizeStatus('pending') : deltaLabel(r.stripeNetMinor, r.ledgerNetMinor),
      status: humanizeStatus(r.status),
    }))}
  />

  <h2 style="font-size: 1.125rem; margin: 2rem 0 0.75rem;">Open differences</h2>
  <Table
    caption="Only rows where Stripe and ledger disagree or the ledger is still waiting."
    columns={[
      { key: 'date', label: 'Date' },
      { key: 'project', label: 'Project' },
      { key: 'difference', label: 'What differs' },
      { key: 'next', label: 'Next step' },
    ]}
    rows={[
      {
        date: '2026-08-26',
        project: displayProject('vitest-run'),
        difference: `Stripe ${formatMoney(89000)} vs ledger ${formatMoney(88500)} (${deltaLabel(89000, 88500)})`,
        next: 'Refund application-fee remainder not posted',
      },
      {
        date: '2026-08-25',
        project: displayProject('tiny-sqlite'),
        difference: `Stripe ${formatMoney(6700)} vs ledger ${formatMoney(7200)} (${deltaLabel(6700, 7200)})`,
        next: 'One-off tip posted twice. Reverse 1030.',
      },
      {
        date: '2026-08-25',
        project: displayProject('ledger-kit'),
        difference: `Stripe ${formatMoney(15400)} on file. Ledger still empty.`,
        next: 'Wait for the capability job. Do not mark aligned.',
      },
      {
        date: '2026-08-24',
        project: displayProject('grove'),
        difference: `Stripe ${formatMoney(33200)} vs ledger ${formatMoney(33100)} (${deltaLabel(33200, 33100)})`,
        next: 'FX presentment rounding. Confirm the Adaptive Pricing window.',
      },
      {
        date: '2026-08-22',
        project: displayProject('otel-lite'),
        difference: 'Stripe payout arrival and posting date off by one day',
        next: 'Timing only if both sides settle 2026-08-23',
      },
    ]}
  />
</AdminShell>
