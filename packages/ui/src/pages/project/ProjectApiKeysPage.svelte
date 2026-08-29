<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { apiKeyRows } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="API keys">
  <p class="pl-muted" style="margin-bottom: 1rem;">
    Scoped keys for server-side integrations. Never expose in client code.
  </p>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Key name" value="analytics-reader" help="Shown in the audit log when the key is used." />
      <TextField label="Scope" value="read:payments, read:memberships" />
      <Button variant="primary">Create API key</Button>
    </div>
  </div>
  <Table
    caption="Active project keys"
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'created', label: 'Created' },
      { key: 'lastUsed', label: 'Last used' },
    ]}
    rows={apiKeyRows}
  />
</DashboardShell>
