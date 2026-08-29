<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import { demoProject, demoSupporters, projectNavGroups, formatMoney } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Supporters">
  <SupporterWall supporters={demoSupporters} currency={demoProject.currency} />
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">All supporters</h2>
  <Table
    columns={[
      { key: 'name', label: 'Display name' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'amount', label: 'Amount' },
      { key: 'public', label: 'Public' },
    ]}
    rows={demoSupporters.map((s) => ({
      name: s.displayName,
      cadence: s.cadence ?? '—',
      amount: s.amountMinor ? formatMoney(s.amountMinor, demoProject.currency) : '—',
      public: s.public ? 'Yes' : 'Private',
    }))}
  />
</DashboardShell>
