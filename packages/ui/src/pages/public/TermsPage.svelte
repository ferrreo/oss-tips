<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Terms of service</h1>
      <p class="pl-muted" style="margin-bottom: 2rem;">Last updated August 2026</p>
      <div class="pl-prose">
        <h2>1. The service</h2>
        <p>oss.tips provides infrastructure for open-source projects to receive support. Projects are independent merchants.</p>
        <h2>2. Accounts</h2>
        <p>Supporters may use guest checkout for one-off support. Accounts are required for subscriptions and entitlements.</p>
        <h2>3. Fees</h2>
        <p>All fees are disclosed before payment confirmation. Platform tips are optional and editable to zero.</p>
        <h2>4. Refunds</h2>
        <p>Refund policy is set by each project subject to Stripe and card network rules.</p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
