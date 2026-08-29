<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';

  let email = $state('guest@example.com');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner variant="info" title="Guest support verified" message="Claim this support to manage entitlements and replies." />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Claim your support</h1>
      <p class="pl-page-lead">
        Link this payment to an oss.tips account using the same email used at checkout.
      </p>
      <div style="margin-top: 1.5rem;">
        <TextField label="Receipt email" type="email" value={email} help="Must match your checkout email." />
        <Button variant="primary" style="margin-top: 1rem;">Send claim code</Button>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
