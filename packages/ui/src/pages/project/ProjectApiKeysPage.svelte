<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="API keys">
  <p class="pl-muted" style="margin-bottom: 1rem;">Scoped keys for server-side integrations. Never expose in client code.</p>
  <Button variant="primary">Create API key</Button>
  <Table
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'created', label: 'Created' },
      { key: 'lastUsed', label: 'Last used' },
    ]}
    rows={[
      { name: 'production-read', scope: 'read:payments', created: '2026-06-01', lastUsed: '2026-08-27' },
      { name: 'ci-tests', scope: 'read:project', created: '2026-07-15', lastUsed: '2026-08-20' },
    ]}
    style="margin-top: 1rem;"
  />
</DashboardShell>
