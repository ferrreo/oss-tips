<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    lead: 'oss.tips is built for money-adjacent workloads with defence in depth. Card data never touches our servers. Privileged admin actions write an immutable audit row.',
    groups: [
      {
        heading: 'Payments',
        items: [
          'Stripe handles card data; oss.tips never stores PANs',
          'Projects are merchants of record via Stripe Connect',
          'Webhook signatures verified on every event',
          'Client redirects never grant entitlements',
        ],
      },
      {
        heading: 'Authentication',
        items: [
          'Email OTP and OAuth. No passwords stored',
          'Session rotation and device-bound tokens',
          'Guest claim and reply links expire and cannot be reused after claim',
        ],
      },
      {
        heading: 'Operations',
        items: [
          'Immutable audit log for privileged admin actions',
          'Encrypted secrets and least-privilege API keys',
          'Manual review for first payment activation and impersonation flags',
        ],
      },
    ],
    report: 'Report abuse or impersonation from any project page. Platform staff see the report in the review queue with the project context attached.',
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Security</h1>
      <div class="pl-prose">
        <p>{pageDemo.lead}</p>
        {#each pageDemo.groups as group (group.heading)}
          <h2>{group.heading}</h2>
          <ul>
            {#each group.items as item (item)}
              <li>{item}</li>
            {/each}
          </ul>
        {/each}
        <h2>Report a project</h2>
        <p>{pageDemo.report}</p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
