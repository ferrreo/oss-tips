<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    nav: [
      { href: '#getting-started', label: 'Getting started' },
      { href: '#projects', label: 'Projects' },
      { href: '#supporters', label: 'Supporters' },
      { href: '#api', label: 'API' },
    ],
    sections: [
      {
        id: 'getting-started',
        heading: 'Getting started',
        body: 'Create a project, connect Stripe, configure up to eight membership tiers, then publish the public page. Payments stay disabled until Stripe reports charges_enabled and payouts_enabled.',
      },
      {
        id: 'projects',
        heading: 'For project owners',
        body: 'The dashboard groups Support, Engage, Grow, Develop, and Manage. Inbox threads stay bound to a payment. Goals use settled project support before fees and never include the supporter tip.',
      },
      {
        id: 'supporters',
        heading: 'For supporters',
        body: 'Sign in with email OTP or OAuth to manage memberships, entitlements, and inbox replies. Guest one-off support needs no account. A claim link can attach the receipt later.',
      },
      {
        id: 'api',
        heading: 'API and webhooks',
        body: 'Checkout sessions are created server-side. Entitlements unlock only after a verified Stripe event. Webhook signatures are checked on every delivery.',
      },
    ],
    endpoints: [
      { method: 'POST', path: '/v1/checkout/sessions', note: 'Create a Stripe Checkout session' },
      { method: 'GET', path: '/v1/projects/:slug', note: 'Public project payload' },
      { method: 'POST', path: '/v1/webhooks/stripe', note: 'Signed event intake' },
    ],
    events: 'payment.succeeded · membership.updated · entitlement.revoked',
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Documentation</h1>
      <nav aria-label="Docs sections" style="margin-bottom: 2rem;">
        <ul class="docs-nav">
          {#each pageDemo.nav as item (item.href)}
            <li><a href={item.href}>{item.label}</a></li>
          {/each}
        </ul>
      </nav>
      <div class="pl-prose">
        {#each pageDemo.sections as section (section.id)}
          <h2 id={section.id}>{section.heading}</h2>
          <p>{section.body}</p>
        {/each}
      </div>
      <ul class="docs-api">
        {#each pageDemo.endpoints as endpoint (endpoint.path)}
          <li class="pl-mono">
            <strong>{endpoint.method}</strong>
            {endpoint.path}
            <span class="pl-muted"> · {endpoint.note}</span>
          </li>
        {/each}
      </ul>
      <p class="pl-mono pl-muted" style="font-size: 0.875rem;">{pageDemo.events}</p>
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .docs-nav {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 0;
  }

  .docs-api {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0 1rem;
  }

  .docs-api li {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--pl-border);
    font-size: 0.875rem;
  }
</style>
