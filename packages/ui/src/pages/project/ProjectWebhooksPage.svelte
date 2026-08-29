<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Webhooks">
  <StatusBanner variant="warning" title="1 failed delivery" message="payment.succeeded to https://api.paperlight.dev/hooks — retry scheduled." />
  <div class="pl-row pl-row--between" style="margin: 1rem 0;">
    <p class="pl-muted">Signed webhook endpoints for your backend.</p>
    <Button variant="primary">Add endpoint</Button>
  </div>
  <Table
    columns={[
      { key: 'url', label: 'URL' },
      { key: 'events', label: 'Events' },
      { key: 'status', label: 'Status' },
    ]}
    rows={[
      { url: 'https://api.paperlight.dev/hooks', events: 'payment.*, membership.*', status: 'active' },
    ]}
  />
</DashboardShell>
