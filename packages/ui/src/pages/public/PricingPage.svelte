<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import Table from '../../components/Table.svelte';

  const pageDemo = {
    lead: 'You see the project amount, the oss.tips fee, and any tip before Stripe Checkout opens.',
    modes: [
      {
        heading: 'Standard mode',
        body: 'The project pays a platform fee on each transaction. Supporters may add an optional tip to oss.tips. The tip is editable to zero and never counted toward a goal.',
      },
      {
        heading: 'Project 5% mode',
        body: 'Some projects absorb the platform fee so the supporter listed amount matches what the project receives, minus Stripe processing. The breakdown still appears before checkout.',
      },
    ],
    columns: [
      { key: 'item', label: 'Shown before checkout' },
      { key: 'standard', label: 'Standard' },
      { key: 'absorbed', label: 'Project 5%' },
    ],
    rows: [
      { item: 'Project receives', standard: '$10.00', absorbed: '$10.00' },
      { item: 'oss.tips project fee', standard: '$0.50 (5%)', absorbed: '$0.00 to supporter' },
      { item: 'Optional tip', standard: '$0.00 to any', absorbed: '$0.00 to any' },
      { item: 'Stripe processing', standard: 'At checkout', absorbed: 'At checkout' },
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="pl-public-hero">
      <div class="pl-container pl-container--reading">
        <p class="pl-public-hero__brand">oss.tips</p>
        <h1 class="pl-display pl-public-hero__title">How fees work</h1>
        <p class="pl-page-lead">{pageDemo.lead}</p>
      </div>
    </section>
    <section class="pl-section" style="padding-top: 0;">
      <div class="pl-container pl-container--reading">
        <div class="pl-prose">
          {#each pageDemo.modes as mode (mode.heading)}
            <h2>{mode.heading}</h2>
            <p>{mode.body}</p>
          {/each}
          <h2>Who pays what</h2>
        </div>
        <div style="margin: 1rem 0 2rem;">
          <Table columns={pageDemo.columns} rows={pageDemo.rows} caption="Example for a $10 project amount" />
        </div>
        <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 0.75rem;">Example disclosure</h2>
        <FeeDisclosure projectAmountMinor={2500} projectFeePercent={5} tipMinor={100} cadence="monthly" currency="USD" />
        <p class="pl-muted" style="font-size: 0.875rem; margin-top: 1.5rem;">
          Stripe may show a local currency at Checkout. Presets still start from the project’s default currency.
        </p>
      </div>
    </section>
  </main>
  <PublicFooter />
</div>
