<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { exportRows } from './project-demo.js';
</script>

<ProjectDashShell title="Exports" lede="Download payments, members, and ledger events for Grove's books.">
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Date range" value="2026-05-01 to 2026-05-29" />
      <TextField label="Destination email" value="finance@grove.dev" />
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
</ProjectDashShell>
