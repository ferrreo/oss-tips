<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    lead: 'oss.tips helps open-source projects take one-off gifts and memberships. The project is the merchant. We run the tooling. We do not hold project money.',
    beliefs: [
      'No project wallet on oss.tips',
      'Fees shown before checkout',
      'One-off gifts work without an account',
      'Memberships give access. There is no shop catalogue',
      'Names and amounts stay private unless a supporter opts in',
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">About oss.tips</h1>
      <div class="pl-prose">
        <p>{pageDemo.lead}</p>
        <h2>What we believe</h2>
        <ul>
          {#each pageDemo.beliefs as belief (belief)}
            <li>{belief}</li>
          {/each}
        </ul>
        <h2>Who it is for</h2>
        <p>
          Maintainers who need steady funding without running a storefront. Supporters who want to know where the money
          goes and what they get back.
        </p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
