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
  <main id="main-content">
    <section class="pl-public-hero">
      <div class="pl-container pl-container--reading">
        <p class="pl-public-hero__brand">oss.tips</p>
        <h1 class="pl-display pl-public-hero__title">Terms of service</h1>
        <p class="pl-page-lead">{pageDemo.updated}</p>
      </div>
    </section>
    <section class="pl-section" style="padding-top: 0;">
      <div class="pl-container pl-container--reading">
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
    </section>
  </main>
  <PublicFooter />
</div>
