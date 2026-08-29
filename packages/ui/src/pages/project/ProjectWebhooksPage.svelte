<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { webhookDeliveries, webhookRows } from './project-demo.js';
</script>

<ProjectDashShell title="Webhooks" lede="Grove sends signed payment and membership events to your servers.">
  <StatusBanner
    variant="warning"
    title="hooks.grove.dev returned an error"
    message="ledger.posted failed once. The next retry is queued; deliveries pause after another failure."
  />
  <div class="pl-row pl-row--between" style="margin: 1rem 0;">
    <p style="margin: 0; color: var(--pl-ink);">{webhookRows.length} endpoints registered.</p>
    <Button variant="primary">Add endpoint</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Endpoint URL" value="https://api.grove.dev/hooks" />
      <TextField label="Events" value="payment.*, membership.*, entitlement.*" help="Use the event names your server already handles." />
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
</ProjectDashShell>
