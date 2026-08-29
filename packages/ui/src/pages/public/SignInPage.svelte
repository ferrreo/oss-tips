<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';

  const pageDemo = {
    title: 'Sign in',
    lead: 'Email one-time passcode. No passwords. OAuth is available for GitHub and Google when you prefer it.',
    oauth: [
      { id: 'github', label: 'Continue with GitHub' },
      { id: 'google', label: 'Continue with Google' },
    ],
  };

  let email = $state('');
  let step = $state<'email' | 'otp'>('email');
  let otp = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-signin-card">
      <h1 class="pl-page-title" style="font-size: 1.5rem;">{pageDemo.title}</h1>
      <p class="pl-muted" style="margin-bottom: 1.5rem;">{pageDemo.lead}</p>
      {#if step === 'email'}
        <TextField
          label="Email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          help="We'll send a 6-digit code."
        />
        <div style="margin-top: 1rem;">
          <Button variant="primary" onclick={() => (step = 'otp')}>Send code</Button>
        </div>
        <p class="pl-muted" style="font-size: 0.8125rem; margin: 1.25rem 0 0.75rem;">Or use an account you already have</p>
        <div class="pl-stack">
          {#each pageDemo.oauth as provider (provider.id)}
            <Button variant="secondary">{provider.label}</Button>
          {/each}
        </div>
      {:else}
        <StatusBanner variant="info" title="Code sent" message={`Check ${email || 'your inbox'} for a 6-digit code.`} />
        <div style="margin-top: 1rem;">
          <TextField label="One-time code" bind:value={otp} placeholder="000000" help="Expires in 10 minutes." />
        </div>
        <div style="margin-top: 1rem;">
          <Button variant="primary">Verify and sign in</Button>
        </div>
        <div style="margin-top: 0.5rem;">
          <Button variant="quiet" onclick={() => (step = 'email')}>Use different email</Button>
        </div>
      {/if}
    </div>
  </main>
  <PublicFooter />
</div>
