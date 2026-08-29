<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';

  interface Props {
    initialStep?: 'email' | 'otp';
    initialEmail?: string;
  }

  let { initialStep = 'email', initialEmail = '' }: Props = $props();

  const pageDemo = {
    title: 'Sign in',
    lead: 'We email a six-digit code. No passwords. You can also use GitHub or Google.',
    oauth: [
      { id: 'github', label: 'Continue with GitHub' },
      { id: 'google', label: 'Continue with Google' },
    ],
  };

  let email = $state(initialEmail);
  let step = $state<'email' | 'otp'>(initialStep);
  let otp = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-signin-card">
      <p class="pl-public-hero__brand">oss.tips</p>
      <h1 class="pl-page-title" style="font-size: 1.75rem;">{pageDemo.title}</h1>
      <p class="pl-page-lead" style="margin-bottom: 1.5rem; font-size: 1rem;">{pageDemo.lead}</p>
      {#if step === 'email'}
        <TextField
          label="Email"
          name="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          help="We send a 6-digit code to this address."
          required
        />
        <div style="margin-top: 1rem;">
          <Button variant="primary" onclick={() => (step = 'otp')}>Send sign-in code</Button>
        </div>
        <p class="pl-muted" style="font-size: 0.875rem; margin: 1.25rem 0 0.75rem;">Or use an account you already have</p>
        <div class="pl-stack">
          {#each pageDemo.oauth as provider (provider.id)}
            <Button variant="secondary">{provider.label}</Button>
          {/each}
        </div>
      {:else}
        <StatusBanner variant="info" title="Code sent" message={`Check ${email || 'your inbox'} for a 6-digit code.`} />
        <div style="margin-top: 1rem;">
          <TextField
            label="One-time code"
            name="otp"
            bind:value={otp}
            placeholder="000000"
            help="Expires in 10 minutes."
            required
          />
        </div>
        <div style="margin-top: 1rem;">
          <Button variant="primary">Verify and sign in</Button>
        </div>
        <div style="margin-top: 0.5rem;">
          <Button variant="quiet" onclick={() => (step = 'email')}>Use a different email</Button>
        </div>
      {/if}
    </div>
  </main>
  <PublicFooter />
</div>
