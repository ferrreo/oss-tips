<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { teamRows } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Team">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Owners, finance, and editors with scoped permissions.</p>
    <Button variant="primary">Invite member</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Email" value="grove@paperlight.dev" />
      <TextField label="Role" value="Editor" help="Owner, Admin, Finance, Editor, Community, or Analyst." />
    </div>
  </div>
  <Table
    caption="People with dashboard access"
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'lastActive', label: 'Last active' },
    ]}
    rows={teamRows}
  />
</DashboardShell>
