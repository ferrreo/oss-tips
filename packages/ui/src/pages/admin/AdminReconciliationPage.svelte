<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { adminNav, reconciliationRows, formatMoney } from './admin-demo.js';

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
    context="Stripe balance transactions vs oss.tips ledger"
    detail="Unexplained differences stay open until a posting or a documented timing window. Do not force-align without a reason."
  />

  <StatusBanner
    variant="warning"
    title="{mismatches.length} settlement mismatches"
    message="Stripe net and ledger net differ on {mismatches.map((r) => r.project).join(', ')}. Combined Stripe-minus-ledger delta is {deltaLabel(mismatchDeltaMinor, 0)}."
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
    caption="Daily net by project. Delta is Stripe net minus ledger net."
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
      project: r.project,
      stripe: formatMoney(r.stripeNetMinor),
      ledger: r.status === 'pending' ? '—' : formatMoney(r.ledgerNetMinor),
      delta: r.status === 'pending' ? 'pending' : deltaLabel(r.stripeNetMinor, r.ledgerNetMinor),
      status: r.status,
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
        project: 'vitest-run',
        difference: `Stripe ${formatMoney(89000)} vs ledger ${formatMoney(88500)} (${deltaLabel(89000, 88500)})`,
        next: 'Refund application-fee remainder not posted',
      },
      {
        date: '2026-08-25',
        project: 'tiny-sqlite',
        difference: `Stripe ${formatMoney(6700)} vs ledger ${formatMoney(7200)} (${deltaLabel(6700, 7200)})`,
        next: 'One-off tip posted twice; reverse 1030',
      },
      {
        date: '2026-08-25',
        project: 'ledger-kit',
        difference: `Stripe ${formatMoney(15400)} on file; ledger still empty`,
        next: 'Wait for capability job; do not mark aligned',
      },
      {
        date: '2026-08-24',
        project: 'paperlight',
        difference: `Stripe ${formatMoney(33200)} vs ledger ${formatMoney(33100)} (${deltaLabel(33200, 33100)})`,
        next: 'FX presentment rounding — confirm Adaptive Pricing window',
      },
      {
        date: '2026-08-22',
        project: 'otel-lite',
        difference: 'Stripe payout arrival vs posting date off by one day',
        next: 'Timing only if both sides settle 2026-08-23',
      },
    ]}
  />
</AdminShell>
