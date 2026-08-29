<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, demoTiers, projectNavGroups } from '../../fixtures/demo.js';
  import { membershipRows } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Membership tiers">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Up to eight tiers. Existing supporters keep their price on changes.</p>
    <Button variant="primary">Add tier</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Tier name" value="Grove" />
      <TextField label="Monthly amount" value="£40.00" />
      <TextField label="Rewards" value="Canopy rewards, private office hours" />
    </div>
  </div>
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    {#each demoTiers as tier (tier.id)}
      <TierCard {tier} currency={demoProject.currency} />
    {/each}
  </div>
  <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Active memberships</h2>
  <Table
    caption="Current entitlements"
    columns={[
      { key: 'name', label: 'Supporter' },
      { key: 'tier', label: 'Tier' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'renews', label: 'Renews' },
    ]}
    rows={membershipRows}
  />
</DashboardShell>
