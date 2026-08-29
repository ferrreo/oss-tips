<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';

  let email = $state('');
  let step = $state<'email' | 'otp'>('email');
  let otp = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-signin-card">
      <h1 class="pl-page-title" style="font-size: 1.5rem;">Sign in</h1>
      <p class="pl-muted" style="margin-bottom: 1.5rem;">Email one-time passcode. No passwords.</p>
      {#if step === 'email'}
        <TextField
          label="Email"
          type="email"
          value={email}
          placeholder="you@example.com"
          help="We'll send a 6-digit code."
        />
        <Button variant="primary" style="width: 100%; margin-top: 1rem;" onclick={() => (step = 'otp')}>
          Send code
        </Button>
      {:else}
        <StatusBanner variant="info" title="Code sent" message={`Check ${email || 'your inbox'} for a 6-digit code.`} />
        <div style="margin-top: 1rem;">
          <TextField label="One-time code" value={otp} placeholder="000000" />
        </div>
        <Button variant="primary" style="width: 100%; margin-top: 1rem;">Verify and sign in</Button>
        <Button variant="quiet" style="margin-top: 0.5rem;" onclick={() => (step = 'email')}>Use different email</Button>
      {/if}
    </div>
  </main>
  <PublicFooter />
</div>
