<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    updated: 'Last updated August 2026',
    sections: [
      {
        heading: '1. The service',
        body: 'oss.tips provides infrastructure for open-source projects to receive support. Projects are independent merchants. The platform does not hold funds or invent an internal wallet.',
      },
      {
        heading: '2. Accounts',
        body: 'Supporters may use guest checkout for one-off support. Accounts are required for subscriptions, entitlements, and inbox replies. Email OTP and OAuth are the only sign-in methods.',
      },
      {
        heading: '3. Fees',
        body: 'All fees are disclosed before payment confirmation. Platform tips are optional and editable to zero. Stripe processing appears in Checkout.',
      },
      {
        heading: '4. Refunds',
        body: 'Refund policy is set by each project subject to Stripe and card network rules. oss.tips may issue an exceptional refund for fraud or duplicates with an audit reason.',
      },
    ],
    docs: [
      { href: '/terms/privacy', label: 'Privacy policy' },
      { href: '/terms/acceptable-use', label: 'Acceptable use' },
      { href: '/terms/refunds', label: 'Refunds and disputes' },
      { href: '/terms/cookies', label: 'Cookie policy' },
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Terms of service</h1>
      <p class="pl-muted" style="margin-bottom: 2rem;">{pageDemo.updated}</p>
      <div class="pl-prose">
        {#each pageDemo.sections as section (section.heading)}
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        {/each}
        <h2>Related documents</h2>
        <ul>
          {#each pageDemo.docs as doc (doc.href)}
            <li><a href={doc.href}>{doc.label}</a></li>
          {/each}
        </ul>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
