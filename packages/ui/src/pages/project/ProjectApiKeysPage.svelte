<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { labelApiScope } from '../../lib/labels.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { apiKeyRows } from './project-demo.js';
</script>

<ProjectDashShell title="API keys" lede="Server keys for Grove. Keep them off public pages and the browser.">
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Key name" value="analytics-reader" help="Shown in the audit log when the key is used." />
      <TextField label="Scope" value="read:payments, read:memberships" help="Comma-separated scopes the key may call." />
      <Button variant="primary">Create API key</Button>
    </div>
  </div>
  <Table
    caption="Active Grove keys"
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'created', label: 'Created' },
      { key: 'lastUsed', label: 'Last used' },
    ]}
    rows={apiKeyRows.map((row) => ({
      ...row,
      scope: labelApiScope(row.scope),
    }))}
  />
</ProjectDashShell>
