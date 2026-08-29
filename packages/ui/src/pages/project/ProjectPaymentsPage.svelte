<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoPayments, projectNavGroups, formatMoney } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Payments">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Settled and pending payments from Stripe.</p>
    <Button variant="secondary">Export CSV</Button>
  </div>
  <Table
    columns={[
      { key: 'date', label: 'Date' },
      { key: 'supporter', label: 'Supporter' },
      { key: 'amount', label: 'Amount' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'status', label: 'Status' },
    ]}
    rows={demoPayments.map((p) => ({
      date: p.date,
      supporter: p.supporter,
      amount: formatMoney(p.amountMinor, p.currency),
      cadence: p.cadence,
      status: p.status,
    }))}
  />
</DashboardShell>
