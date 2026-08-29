<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import { demoProject, demoTiers } from '../../fixtures/demo.js';

  const pageDemo = {
    lead: 'Pick a cadence and amount, then continue to Stripe. Access is granted only after Stripe confirms the payment.',
    tiers: demoTiers,
  };

  let selectedTier = $state('supporter');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-container" style="padding-top: 1rem; padding-bottom: 3rem;">
      <ProjectHero project={demoProject} />
      <p class="pl-page-lead" style="margin-bottom: 1.5rem;">{pageDemo.lead}</p>
      <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 1rem;">Choose support</h2>
      <div class="ps-tiers">
        {#each pageDemo.tiers as tier (tier.id)}
          <TierCard
            {tier}
            currency={demoProject.currency}
            selected={selectedTier === tier.id}
            onclick={() => (selectedTier = tier.id)}
          />
        {/each}
      </div>
      <SupportComposer tiers={pageDemo.tiers} currency={demoProject.currency} />
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .ps-tiers {
    display: grid;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  @media (min-width: 44rem) {
    .ps-tiers {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 72rem) {
    .ps-tiers {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
