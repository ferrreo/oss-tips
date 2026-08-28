<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import { demoProject, formatMoney } from '../../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner variant="info" title="Payment received" message="Your support is being processed. Entitlements activate after Stripe verification." />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Thank you for supporting {demoProject.name}</h1>
      <p class="pl-page-lead">
        You paid {formatMoney(1000, demoProject.currency)} to {demoProject.name}. Receipt will be emailed shortly.
      </p>
      <div style="margin: 1.5rem 0;">
        <FeeDisclosure projectAmountMinor={1000} tipMinor={0} cadence="monthly" />
      </div>
      <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 1rem;">
        Entitlement: Sapling rewards for 30 days (expires 2026-09-27)
      </p>
      <div class="pl-row">
        <Button variant="primary">Create account to manage support</Button>
        <Button variant="secondary">Return to project</Button>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
