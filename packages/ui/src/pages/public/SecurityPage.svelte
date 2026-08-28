<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Security</h1>
      <div class="pl-prose">
        <p>oss.tips is built for money-adjacent workloads with defence in depth.</p>
        <h2>Payments</h2>
        <ul>
          <li>Stripe handles card data; oss.tips never stores PANs</li>
          <li>Projects are merchants of record via Stripe Connect</li>
          <li>Webhook signatures verified on every event</li>
        </ul>
        <h2>Authentication</h2>
        <ul>
          <li>Email OTP and OAuth—no passwords stored</li>
          <li>Session rotation and device-bound tokens</li>
        </ul>
        <h2>Operations</h2>
        <ul>
          <li>Immutable audit log for privileged admin actions</li>
          <li>Encrypted secrets and least-privilege API keys</li>
        </ul>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
