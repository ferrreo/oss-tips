<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import { demoProject, formatMoney } from '../../fixtures/demo.js';

  const pageDemo = {
    amountMinor: 1000,
    cadence: 'monthly',
    tier: 'Sapling',
    entitlement: 'Sapling rewards for 30 days',
    expires: '2026-09-27',
    reference: 'cs_test_a1GroveSapling',
    receiptEmail: 'ada@example.com',
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner
        variant="info"
        title="Payment received"
        message="Your support is being processed. Entitlements activate after Stripe verification."
      />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Thank you for supporting {demoProject.name}</h1>
      <p class="pl-page-lead">
        You paid {formatMoney(pageDemo.amountMinor, demoProject.currency)} {pageDemo.cadence} to {demoProject.name}. A receipt will be emailed to {pageDemo.receiptEmail}.
      </p>
      <dl class="cs-meta">
        <div>
          <dt class="pl-muted">Tier</dt>
          <dd>{pageDemo.tier}</dd>
        </div>
        <div>
          <dt class="pl-muted">Entitlement</dt>
          <dd>{pageDemo.entitlement} (expires {pageDemo.expires})</dd>
        </div>
        <div>
          <dt class="pl-muted">Reference</dt>
          <dd class="pl-mono">{pageDemo.reference}</dd>
        </div>
      </dl>
      <div style="margin: 1.5rem 0;">
        <FeeDisclosure
          projectAmountMinor={pageDemo.amountMinor}
          tipMinor={0}
          cadence={pageDemo.cadence}
        />
      </div>
      <div class="pl-row" style="flex-wrap: wrap;">
        <Button variant="primary">Create account to manage support</Button>
        <Button variant="secondary">Return to project</Button>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .cs-meta {
    display: grid;
    gap: 0.75rem;
    margin: 1.5rem 0 0;
  }

  .cs-meta dt {
    font-size: 0.75rem;
    margin-bottom: 0.15rem;
  }

  .cs-meta dd {
    margin: 0;
  }
</style>
