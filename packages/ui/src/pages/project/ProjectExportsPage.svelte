<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Exports">
  <p class="pl-muted" style="margin-bottom: 1rem;">Download ledger-aligned exports for finance review.</p>
  <Table
    columns={[
      { key: 'type', label: 'Export type' },
      { key: 'range', label: 'Date range' },
      { key: 'action', label: '' },
    ]}
    rows={[
      { type: 'Payments', range: 'August 2026', action: 'Download' },
      { type: 'Memberships', range: 'All time', action: 'Download' },
      { type: 'Ledger events', range: 'Last 30 days', action: 'Download' },
    ]}
  />
  <Button variant="secondary" style="margin-top: 1rem;">Request custom export</Button>
</DashboardShell>
