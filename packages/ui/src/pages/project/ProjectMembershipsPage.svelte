<script lang="ts">
  import TierCard from '../../components/TierCard.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, demoTiers } from '../../fixtures/demo.js';
  import { labelCadence, labelMembershipStatus } from '../../lib/labels.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { membershipRows } from './project-demo.js';
</script>

<ProjectDashShell
  title="Membership tiers"
  lede="Up to eight tiers. People who already pay keep their price if you change one."
>
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p style="margin: 0; color: var(--pl-ink);">Coffee, Supporter, Backer, and Champion are live.</p>
    <Button variant="primary">Add tier</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Tier name" value="Patron" />
      <TextField label="Monthly amount" value="$40.00" />
      <TextField label="Rewards" value="Champion rewards, private office hours" />
    </div>
  </div>
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    {#each demoTiers as tier (tier.id)}
      <TierCard {tier} currency={demoProject.currency} />
    {/each}
  </div>
  <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Active memberships</h2>
  <Table
    caption="Current Grove entitlements"
    columns={[
      { key: 'name', label: 'Supporter' },
      { key: 'tier', label: 'Tier' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'renews', label: 'Renews' },
    ]}
    rows={membershipRows.map((row) => ({
      ...row,
      cadence: labelCadence(row.cadence),
      status: labelMembershipStatus(row.status),
    }))}
  />
</ProjectDashShell>
