<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { webhookDeliveries, webhookRows } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Webhooks">
  <StatusBanner
    variant="warning"
    title="1 failed delivery"
    message="ledger.posted to https://hooks.paperlight.dev/ledger — retry scheduled."
  />
  <div class="pl-row pl-row--between" style="margin: 1rem 0;">
    <p class="pl-muted">Signed webhook endpoints for your backend.</p>
    <Button variant="primary">Add endpoint</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Endpoint URL" value="https://api.paperlight.dev/hooks" />
      <TextField label="Events" value="payment.*, membership.*, entitlement.*" />
    </div>
  </div>
  <Table
    caption="Registered endpoints"
    columns={[
      { key: 'url', label: 'URL' },
      { key: 'events', label: 'Events' },
      { key: 'status', label: 'Status' },
      { key: 'last', label: 'Last delivery' },
    ]}
    rows={webhookRows}
  />
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">Recent deliveries</h2>
  <Table
    caption="Latest signed deliveries"
    columns={[
      { key: 'id', label: 'Delivery' },
      { key: 'event', label: 'Event' },
      { key: 'target', label: 'Target' },
      { key: 'code', label: 'Status' },
      { key: 'time', label: 'When' },
    ]}
    rows={webhookDeliveries}
  />
</DashboardShell>
