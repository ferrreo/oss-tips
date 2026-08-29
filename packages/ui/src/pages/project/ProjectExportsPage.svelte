<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { exportRows } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Exports">
  <p class="pl-muted" style="margin-bottom: 1rem;">Download ledger-aligned exports for finance review.</p>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Date range" value="2026-08-01 to 2026-08-29" />
      <TextField label="Destination email" value="finance@paperlight.dev" />
      <Button variant="secondary">Request custom export</Button>
    </div>
  </div>
  <Table
    caption="Available downloads"
    columns={[
      { key: 'type', label: 'Export type' },
      { key: 'range', label: 'Date range' },
      { key: 'format', label: 'Format' },
      { key: 'status', label: 'Status' },
    ]}
    rows={exportRows}
  />
</DashboardShell>
