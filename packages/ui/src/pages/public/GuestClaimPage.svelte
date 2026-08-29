<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoProject, formatMoney } from '../../fixtures/demo.js';

  const pageDemo = {
    amountMinor: 5000,
    cadence: 'one-off',
    reference: 'pi_3PaperlightGift',
    expires: '2026-09-05',
  };

  let email = $state('guest@example.com');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner
        variant="info"
        title="Guest support verified"
        message="Claim this support to manage entitlements and replies."
      />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Claim your support</h1>
      <p class="pl-page-lead">
        Link this {formatMoney(pageDemo.amountMinor, demoProject.currency)} {pageDemo.cadence} payment to {demoProject.name} using the same email used at checkout.
      </p>
      <p class="pl-mono pl-muted" style="font-size: 0.8125rem; margin: 1rem 0;">
        {pageDemo.reference} · link expires {pageDemo.expires}
      </p>
      <div style="margin-top: 1.5rem;">
        <TextField label="Receipt email" type="email" bind:value={email} help="Must match your checkout email." />
        <div style="margin-top: 1rem;">
          <Button variant="primary">Send claim code</Button>
        </div>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
