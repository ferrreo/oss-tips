<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Documentation</h1>
      <nav aria-label="Docs sections" style="margin-bottom: 2rem;">
        <ul style="list-style: none; padding: 0; display: flex; gap: 1rem; flex-wrap: wrap;">
          <li><a href="#getting-started">Getting started</a></li>
          <li><a href="#projects">Projects</a></li>
          <li><a href="#supporters">Supporters</a></li>
          <li><a href="#api">API</a></li>
        </ul>
      </nav>
      <div class="pl-prose">
        <h2 id="getting-started">Getting started</h2>
        <p>Create a project, connect Stripe, configure tiers, and publish your public page.</p>
        <h2 id="projects">For project owners</h2>
        <p>Manage memberships, posts, goals, Discord roles, and team permissions from the project dashboard.</p>
        <h2 id="supporters">For supporters</h2>
        <p>Sign in with email OTP to manage memberships, entitlements, and inbox replies.</p>
        <h2 id="api">API & webhooks</h2>
        <p class="pl-mono">POST /v1/checkout/sessions · webhook events: payment.succeeded, membership.updated</p>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
