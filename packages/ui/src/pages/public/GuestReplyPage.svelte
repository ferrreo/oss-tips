<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoThreads } from '../../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <StatusBanner variant="info" title="Guest reply link" message="This secure link expires in 7 days. Do not share publicly." />
      <h1 class="pl-page-title" style="margin-top: 1.5rem;">Reply to project</h1>
      <p class="pl-page-lead">Continue your conversation without creating a full account.</p>
      <div style="margin-top: 1.5rem;">
        <ThreadView thread={demoThreads[1]} />
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
