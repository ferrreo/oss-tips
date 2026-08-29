<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoTiers, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Membership tiers">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Up to eight tiers. Existing supporters keep their price on changes.</p>
    <Button variant="primary">Add tier</Button>
  </div>
  <div class="pl-grid-3">
    {#each demoTiers as tier (tier.id)}
      <TierCard tier={tier} currency={demoProject.currency} />
    {/each}
  </div>
</DashboardShell>
