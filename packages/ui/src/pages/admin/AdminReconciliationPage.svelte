<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { adminNavGroups, formatMoney } from '../../fixtures/demo.js';
</script>

<AdminShell navGroups={adminNavGroups} title="Reconciliation">
  <StatusBanner variant="warning" title="3 settlement mismatches" message="Stripe balance transactions pending ledger alignment." />
  <Table
    columns={[
      { key: 'date', label: 'Date' },
      { key: 'project', label: 'Project' },
      { key: 'stripe', label: 'Stripe net' },
      { key: 'ledger', label: 'Ledger net' },
      { key: 'delta', label: 'Delta' },
    ]}
    rows={[
      { date: '2026-08-27', project: 'paperlight', stripe: formatMoney(124500), ledger: formatMoney(124500), delta: '£0.00' },
      { date: '2026-08-26', project: 'vitest-run', stripe: formatMoney(89000), ledger: formatMoney(88500), delta: formatMoney(-500) },
    ]}
    style="margin-top: 1rem;"
  />
</AdminShell>
