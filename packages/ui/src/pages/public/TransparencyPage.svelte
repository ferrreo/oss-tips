<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import DataCard from '../../components/DataCard.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Transparency</h1>
      <p class="pl-page-lead">Platform counters derived from settled data only.</p>
      <div class="pl-grid-3" style="margin-top: 2rem;">
        <DataCard label="Projects published" value="1,248" compare="+12 this month" compareDirection="up" />
        <DataCard label="Support processed (30d)" value="£2.4M" compare="Settled volume" />
        <DataCard label="Median project fee" value="5.0%" compare="Standard mode" />
      </div>
      <div class="pl-prose" style="margin-top: 2rem;">
        <h2>How we report</h2>
        <p>Figures update after Stripe settlement. We do not show vanity metrics or payment-volume leaderboards.</p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
