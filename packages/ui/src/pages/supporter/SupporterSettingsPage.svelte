<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import SupporterAccountNav from './SupporterAccountNav.svelte';
  import { supporterEmail, supporterName } from './supporter-demo.js';

  let displayName = $state(supporterName);
  let email = $state(supporterEmail);
  let theme = $state('system');
  let wallName = $state('public');
  let wallAmount = $state('hidden');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-public-hero__brand">oss.tips</p>
      <h1 class="pl-page-title">Account settings</h1>
      <p class="pl-page-lead">Sign-in, receipts, and how you appear on public supporter walls.</p>
      <SupporterAccountNav current="settings" />

      <div class="pl-stack" style="margin-top: 0.5rem;">
        <TextField
          label="Display name"
          name="display-name"
          bind:value={displayName}
          help="Shown on public supporter walls when you opt in. Projects never receive your email from this field."
        />
        <TextField
          label="Email"
          name="account-email"
          type="email"
          bind:value={email}
          help="Used for OTP sign-in and Stripe receipts. Changing it starts a verification email."
        />

        <div>
          <SegmentedControl
            label="Theme preference"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            bind:value={theme}
          />
          <p class="pl-field__help" style="margin: 0.5rem 0 0;">Stored on this device and on your account when signed in.</p>
        </div>

        <div>
          <SegmentedControl
            label="Public wall name"
            options={[
              { value: 'public', label: 'Show name' },
              { value: 'anonymous', label: 'Anonymous' },
            ]}
            bind:value={wallName}
          />
          <p class="pl-field__help" style="margin: 0.5rem 0 0;">Default for new support. You can change this per payment.</p>
        </div>

        <div>
          <SegmentedControl
            label="Public wall amount"
            options={[
              { value: 'hidden', label: 'Hide amount' },
              { value: 'shown', label: 'Show amount' },
            ]}
            bind:value={wallAmount}
          />
          <p class="pl-field__help" style="margin: 0.5rem 0 0;">Amount is hidden unless you enable it.</p>
        </div>

        <Button variant="primary">Save changes</Button>
      </div>

      <hr class="pl-rule" style="margin: 2rem 0;" />

      <h2 style="font-size: 1.125rem; margin-bottom: 0.5rem;">Your data</h2>
      <p class="pl-muted" style="margin: 0 0 1rem; font-size: 0.875rem;">
        Export a copy of memberships, access records, and public wall messages. Deletion keeps financial records we must retain.
      </p>
      <div class="pl-row" style="flex-wrap: wrap;">
        <Button variant="secondary">Request export</Button>
        <Button variant="destructive">Delete account</Button>
      </div>
    </div>
  </main>
</div>
