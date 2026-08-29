<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Stripe">
  <StatusBanner variant="warning" title="Action required" message="Additional verification needed for payouts_enabled." />
  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="Charges" value="Enabled" />
    <DataCard label="Payouts" value="Restricted" compare="Complete verification" />
    <DataCard label="Connect account" value="acct_1Paperlight" />
  </div>
  <Button variant="primary">Continue Stripe verification</Button>
  <p class="pl-muted" style="font-size: 0.875rem; margin-top: 1rem;">
    Payout details are managed in Stripe. oss.tips cannot change bank accounts.
  </p>
</DashboardShell>
