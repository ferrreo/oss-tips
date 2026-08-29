<script lang="ts">
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Table from '../../components/Table.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { discordRoleRows } from './project-demo.js';
</script>

<ProjectDashShell title="Discord" lede="Grove grants Discord roles when a membership is active.">
  <StatusBanner
    variant="info"
    title="Bot connected"
    message="Roles update when a Grove membership starts, renews, or ends."
  />
  <div class="pl-stack" style="margin-top: 1.5rem; max-width: 36rem;">
    <TextField label="Discord server ID" value="123456789012345678" />
    <TextField
      label="Bot invite URL"
      value="https://discord.com/oauth2/authorize?client_id=grove-bot&scope=bot"
      help="Re-invite if permissions change."
    />
    <TextField label="Default role" value="supporters" />
    <Button variant="primary">Save Discord settings</Button>
  </div>
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">Tier role mappings</h2>
  <Table
    caption="Roles granted from active Grove entitlements"
    columns={[
      { key: 'tier', label: 'Tier' },
      { key: 'role', label: 'Discord role' },
      { key: 'members', label: 'Members' },
      { key: 'lastSync', label: 'Last sync' },
    ]}
    rows={discordRoleRows}
  />
</ProjectDashShell>
