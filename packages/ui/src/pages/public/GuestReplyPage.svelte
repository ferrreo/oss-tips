<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import { cadencePhrase } from '../labels.js';
  import { demoThreads, demoProject, formatMoney } from '../../fixtures/demo.js';

  function requireGroveThread() {
    const thread = demoThreads.find((item) => item.id === 't2');
    if (!thread) throw new Error('Grove demo thread t2 is missing');
    return thread;
  }

  const thread = requireGroveThread();

  let reply = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-public-hero__brand">oss.tips</p>
      <StatusBanner
        variant="info"
        title="Guest reply link"
        message="This secure link expires in 7 days. Do not share it publicly."
      />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Reply to {demoProject.name}</h1>
      <p class="pl-page-lead">
        Continue the thread for your {formatMoney(thread.amountMinor, demoProject.currency)}
        {cadencePhrase(thread.cadence)} without creating a full account.
      </p>
      <div style="margin-top: 1.5rem;">
        <ThreadView {thread} />
      </div>
      <div style="margin-top: 1.25rem;">
        <TextField
          label="Your reply"
          name="guest-reply"
          bind:value={reply}
          placeholder="Write a reply to the Grove team…"
          help="No attachments in beta. The project will not see your email address from this form."
        />
        <div style="margin-top: 1rem;">
          <Button variant="primary">Send reply</Button>
        </div>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
