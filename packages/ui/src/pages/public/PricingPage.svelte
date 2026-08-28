<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">How fees work</h1>
      <p class="pl-page-lead">Transparent pricing before you confirm any payment. No surprises at checkout.</p>
      <div class="pl-prose">
        <h2>Standard mode</h2>
        <p>Projects pay a platform fee on each transaction. Supporters may optionally add a tip to oss.tips.</p>
        <h2>Project 5% mode</h2>
        <p>Some projects absorb the platform fee. Supporters still see the breakdown before paying.</p>
        <h2>Example disclosure</h2>
      </div>
      <div style="margin-top: 1.5rem;">
        <FeeDisclosure projectAmountMinor={2500} projectFeePercent={5} tipMinor={100} cadence="monthly" />
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
