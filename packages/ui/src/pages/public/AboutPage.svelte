<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">About oss.tips</h1>
      <div class="pl-prose">
        <p>
          oss.tips gives open-source projects a calm, transparent place to receive one-off support and recurring memberships.
          Projects own the relationship—they are the merchant of record. We supply infrastructure, not custody.
        </p>
        <h2>What we believe</h2>
        <ul>
          <li>No hidden platform balance or internal wallet</li>
          <li>Fees disclosed before every checkout</li>
          <li>Guest-friendly one-off support without forced accounts</li>
          <li>Rewards as memberships, not a hidden shop</li>
        </ul>
        <h2>Who we serve</h2>
        <p>
          Maintainers who need sustainable funding without becoming shopkeepers. Supporters who want clarity about where
          money goes and what they receive in return.
        </p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
