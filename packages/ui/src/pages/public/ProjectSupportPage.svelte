<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import { demoProject, demoTiers } from '../../fixtures/demo.js';

  const pageDemo = {
    lead: 'Pick a cadence and amount, then continue to Stripe. Access is granted only after Stripe confirms the payment.',
    tiers: demoTiers,
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <HeroLandscape compact />
    <div class="pl-container" style="padding-top: 0.5rem; padding-bottom: 3rem;">
      <ProjectHero project={demoProject} />
      <p class="pl-page-lead" style="margin-bottom: 1.5rem;">{pageDemo.lead}</p>
      <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 1rem;">Choose support</h2>
      <SupportComposer tiers={pageDemo.tiers} currency={demoProject.currency} />
    </div>
  </main>
  <PublicFooter />
</div>
