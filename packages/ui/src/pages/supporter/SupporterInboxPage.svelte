<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import Badge from '../../components/Badge.svelte';
  import { formatMoney } from '../../fixtures/demo.js';
  import SupporterAccountNav from './SupporterAccountNav.svelte';
  import { supporterThreads } from './supporter-demo.js';

  let selectedId = $state(supporterThreads[0].id);
  const selected = $derived(supporterThreads.find((t) => t.id === selectedId) ?? supporterThreads[0]);
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Inbox</h1>
      <p class="pl-page-lead">Replies from projects you support. Threads stay bound to the payment that started them.</p>
      <SupporterAccountNav current="inbox" />

      <div class="pl-grid-2">
        <ul style="list-style: none; padding: 0; margin: 0;">
          {#each supporterThreads as thread (thread.id)}
            <li style="border-bottom: 1px solid var(--pl-border);">
              <button
                type="button"
                class="pl-focus-ring inbox-item"
                aria-current={thread.id === selectedId ? 'true' : undefined}
                onclick={() => (selectedId = thread.id)}
              >
                <div class="pl-row pl-row--between">
                  <strong>{thread.subject}</strong>
                  {#if thread.unread}
                    <Badge variant="forest">Unread</Badge>
                  {/if}
                </div>
                <span class="pl-muted" style="font-size: 0.8125rem;">
                  {thread.project} · {formatMoney(thread.amountMinor)} · {thread.cadence}
                </span>
              </button>
            </li>
          {/each}
        </ul>
        <ThreadView thread={selected} />
      </div>
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .inbox-item {
    display: block;
    width: 100%;
    padding: 0.875rem 0.25rem;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }

  .inbox-item[aria-current='true'] {
    background: color-mix(in srgb, var(--pl-forest) 8%, var(--pl-surface));
    padding-inline: 0.75rem;
    margin-inline: -0.5rem;
    width: calc(100% + 1rem);
    border-radius: var(--pl-radius-md);
  }
</style>
