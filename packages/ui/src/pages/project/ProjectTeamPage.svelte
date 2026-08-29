<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Team">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Owners, finance, and editors with scoped permissions.</p>
    <Button variant="primary">Invite member</Button>
  </div>
  <Table
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
    ]}
    rows={[
      { name: 'Ada Lovelace', email: 'ada@paperlight.dev', role: 'Owner' },
      { name: 'Marcus Chen', email: 'marcus@paperlight.dev', role: 'Finance' },
      { name: 'Yuki Sato', email: 'yuki@paperlight.dev', role: 'Editor' },
    ]}
  />
</DashboardShell>
