<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import { demoProject, demoTiers } from '../../fixtures/demo.js';

  let selectedTier = $state(demoTiers[1].id);
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-container" style="padding-top: 1rem;">
      <ProjectHero project={demoProject} />
      <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 1rem;">Choose support</h2>
      <div class="pl-grid-3" style="margin-bottom: 2rem;">
        {#each demoTiers as tier (tier.id)}
          <TierCard
            tier={tier}
            currency={demoProject.currency}
            selected={selectedTier === tier.id}
            onclick={() => (selectedTier = tier.id)}
          />
        {/each}
      </div>
      <SupportComposer currency={demoProject.currency} />
    </div>
  </main>
  <PublicFooter />
</div>
