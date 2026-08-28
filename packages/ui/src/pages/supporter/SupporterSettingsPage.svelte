<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';

  let displayName = $state('Ada L.');
  let email = $state('ada@example.com');
  let theme = $state('system');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <h1 class="pl-page-title">Account settings</h1>
      <div class="pl-stack" style="margin-top: 1.5rem;">
        <TextField label="Display name" value={displayName} help="Shown on public supporter walls when opted in." />
        <TextField label="Email" type="email" value={email} help="Used for OTP sign-in and receipts." />
        <div>
          <span class="pl-field__label">Theme preference</span>
          <SegmentedControl
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            value={theme}
            onchange={(v) => (theme = v)}
          />
        </div>
        <Button variant="primary">Save changes</Button>
      </div>
    </div>
  </main>
</div>
