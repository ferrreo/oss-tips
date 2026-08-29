<script lang="ts">
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import TextField from '../../components/TextField.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { teamRows } from './project-demo.js';
</script>

<ProjectDashShell title="Team" lede="People who can change Grove's page, money, or posts.">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p style="margin: 0; color: var(--pl-ink);">{teamRows.length} people have dashboard access.</p>
    <Button variant="primary">Invite member</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Email" value="grove@grove.dev" />
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
</ProjectDashShell>
