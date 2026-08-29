<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import { cadencePhrase } from '../labels.js';
  import { demoProject, formatMoney } from '../../fixtures/demo.js';

  const pageDemo = {
    amountMinor: 1000,
    cadence: 'monthly',
    tier: 'Sapling',
    entitlement: 'Sapling rewards for 30 days',
    expires: '27 Sep 2026',
    reference: 'cs_test_a1GroveSapling',
    receiptEmail: 'ada@example.com',
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-public-hero__brand">oss.tips</p>
      <StatusBanner
        variant="info"
        title="Payment received"
        message="Stripe received the payment. Access starts after it confirms."
      />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Thank you for supporting {demoProject.name}</h1>
      <p class="pl-page-lead">
        You paid {formatMoney(pageDemo.amountMinor, demoProject.currency)} as a {cadencePhrase(pageDemo.cadence)} to
        {demoProject.name}. A receipt will be emailed to {pageDemo.receiptEmail}.
      </p>
      <dl class="cs-meta">
        <div>
          <dt class="pl-muted">Tier</dt>
          <dd>{pageDemo.tier}</dd>
        </div>
        <div>
          <dt class="pl-muted">Access</dt>
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
        <a class="pl-btn pl-btn--primary pl-focus-ring" href="/signin">Create an account to manage this support</a>
        <a class="pl-btn pl-btn--secondary pl-focus-ring" href="/{demoProject.slug}">Return to {demoProject.name}</a>
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
    font-size: 0.8125rem;
    margin-bottom: 0.15rem;
  }

  .cs-meta dd {
    margin: 0;
  }
</style>
