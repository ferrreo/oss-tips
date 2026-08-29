<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import { demoThreads, demoProject, formatMoney } from '../../fixtures/demo.js';

  const thread = demoThreads.find((item) => item.id === 't2');

  const pageDemo = {
    thread,
    expires: '7 days',
    amountMinor: thread?.amountMinor ?? 0,
  };

  let reply = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner
        variant="info"
        title="Guest reply link"
        message={`This secure link expires in ${pageDemo.expires}. Do not share it publicly.`}
      />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Reply to {demoProject.name}</h1>
      {#if pageDemo.thread}
        <p class="pl-page-lead">
          Continue the thread for your {formatMoney(pageDemo.amountMinor, demoProject.currency)} {pageDemo.thread.cadence} support without creating a full account.
        </p>
        <div style="margin-top: 1.5rem;">
          <ThreadView thread={pageDemo.thread} />
        </div>
      {/if}
      <div style="margin-top: 1.25rem;">
        <TextField
          label="Your reply"
          bind:value={reply}
          placeholder="Write a reply to the project…"
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
