<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    lead: 'oss.tips helps open-source projects take one-off support and memberships. The project is the merchant. We run the tooling. We do not hold project money.',
    beliefs: [
      'No project wallet on oss.tips',
      'Fees shown before checkout',
      'One-off support works without an account',
      'Memberships give access. There is no shop catalogue',
      'Names and amounts stay private unless a supporter opts in',
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="pl-public-hero">
      <div class="pl-container pl-container--reading">
        <p class="pl-public-hero__brand">oss.tips</p>
        <h1 class="pl-display pl-public-hero__title">About</h1>
        <p class="pl-page-lead">{pageDemo.lead}</p>
      </div>
    </section>
    <section class="pl-section" style="padding-top: 0;">
      <div class="pl-container pl-container--reading">
        <div class="pl-prose">
          <h2>How it works</h2>
          <ul>
            {#each pageDemo.beliefs as belief (belief)}
              <li>{belief}</li>
            {/each}
          </ul>
          <h2>Who uses it</h2>
          <p>
            Maintainers who need steady funding without running a storefront. Supporters who want to know where the money
            goes and what access they receive.
          </p>
        </div>
      </div>
    </section>
  </main>
  <PublicFooter />
</div>
