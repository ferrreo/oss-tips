<script lang="ts">
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';
  import { labelStripeCapability } from '../../lib/labels.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { stripeCapabilityRows } from './project-demo.js';
</script>

<ProjectDashShell title="Stripe" lede="Stripe paused payouts until Grove finishes identity verification.">
  <StatusBanner
    variant="warning"
    title="Action required"
    message="Stripe paused payouts until Grove finishes identity verification."
  />
  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="Charges" value="Enabled" />
    <DataCard label="Payouts" value="Restricted" compare="Complete verification" />
    <DataCard label="Connect account" value="acct_1Grove" />
  </div>
  <Button variant="primary">Continue Stripe verification</Button>
  <p style="font-size: 0.875rem; margin-top: 1rem; color: var(--pl-ink);">
    Payout details are managed in Stripe. oss.tips cannot change bank accounts.
  </p>
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">Capabilities</h2>
  <Table
    caption="Stripe Connect capability snapshot"
    columns={[
      { key: 'capability', label: 'Capability' },
      { key: 'status', label: 'Status' },
      { key: 'detail', label: 'Detail' },
    ]}
    rows={stripeCapabilityRows.map((row) => ({
      ...row,
      capability: labelStripeCapability(row.capability),
    }))}
  />
</ProjectDashShell>
