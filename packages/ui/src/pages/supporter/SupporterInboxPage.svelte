<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import Badge from '../../components/Badge.svelte';
  import { demoThreads } from '../../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Inbox</h1>
      <p class="pl-page-lead">Replies from projects you support.</p>
      <ul style="list-style: none; padding: 0; margin: 1.5rem 0;">
        {#each demoThreads as thread (thread.id)}
          <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--pl-border);">
            <div class="pl-row pl-row--between">
              <strong>{thread.subject}</strong>
              {#if thread.unread}
                <Badge variant="forest">Unread</Badge>
              {/if}
            </div>
            <span class="pl-muted" style="font-size: 0.8125rem;">{thread.project}</span>
          </li>
        {/each}
      </ul>
      <ThreadView thread={demoThreads[0]} />
    </div>
  </main>
</div>
