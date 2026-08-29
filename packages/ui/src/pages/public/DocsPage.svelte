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
        body: 'Create a project, connect Stripe, add membership tiers, then publish. Payments stay off until Stripe says the account can charge and pay out.',
      },
      {
        id: 'projects',
        heading: 'For project owners',
        body: 'Use the dashboard for payments, posts, goals, Discord roles, and team access. Inbox threads stay tied to a payment. Goals count settled project support before fees, and never the tip to oss.tips.',
      },
      {
        id: 'supporters',
        heading: 'For supporters',
        body: 'Sign in with an email code or OAuth to manage memberships and replies. One-off gifts work as a guest. You can claim the receipt later with a link.',
      },
      {
        id: 'api',
        heading: 'API and webhooks',
        body: 'Checkout sessions are created on the server. Access is granted only after a verified Stripe event. Outgoing webhooks are signed.',
      },
    ],
    endpoints: [
      { method: 'POST', path: '/v1/checkout/sessions', note: 'Start Checkout' },
      { method: 'GET', path: '/v1/projects/:slug', note: 'Public project' },
      { method: 'POST', path: '/v1/webhooks/stripe', note: 'Stripe events in' },
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
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0;
  }

  .docs-nav a {
    font-weight: 600;
  }

  .docs-api {
    list-style: none;
    padding: 0;
    margin: 2rem 0 1rem;
    display: grid;
    gap: 0.75rem;
  }
</style>
