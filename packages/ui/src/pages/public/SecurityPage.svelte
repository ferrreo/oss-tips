<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    lead: 'Card numbers never hit oss.tips. Stripe takes payments. Admin actions are logged and cannot be edited quietly.',
    groups: [
      {
        heading: 'Payments',
        items: [
          'Stripe stores card details. We do not.',
          'Each project is the merchant on Stripe Connect.',
          'Every Stripe webhook is signature-checked.',
          'A browser redirect alone never grants access.',
        ],
      },
      {
        heading: 'Sign-in',
        items: [
          'Email codes or OAuth. No passwords on oss.tips.',
          'Sessions can be listed and revoked.',
          'Guest claim and reply links expire after use.',
        ],
      },
      {
        heading: 'Operations',
        items: [
          'Privileged admin steps write an audit entry.',
          'API keys are scoped and hashed at rest.',
          'First payouts and odd ownership claims go through review.',
        ],
      },
    ],
    report: 'Use Report on any project page. Staff see the report next to that project in the review queue.',
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="pl-public-hero">
      <div class="pl-container pl-container--reading">
        <p class="pl-public-hero__brand">oss.tips</p>
        <h1 class="pl-display pl-public-hero__title">Security</h1>
        <p class="pl-page-lead">{pageDemo.lead}</p>
      </div>
    </section>
    <section class="pl-section" style="padding-top: 0;">
      <div class="pl-container pl-container--reading">
        <div class="pl-prose">
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
    </section>
  </main>
  <PublicFooter />
</div>
