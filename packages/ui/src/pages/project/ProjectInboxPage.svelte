<script lang="ts">
  import ThreadView from '../../components/ThreadView.svelte';
  import { labelCadence } from '../../lib/labels.js';
  import type { Thread } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { inboxPreviewFromThread, inboxThreads } from './project-demo.js';

  const threads: Thread[] = inboxThreads.map((thread) => ({
    ...thread,
    cadence: labelCadence(thread.cadence),
  }));
  const initialThread = threads[0] as Thread;
  let selectedId = $state(initialThread.id);
  const selected = $derived(threads.find((thread) => thread.id === selectedId) ?? initialThread);
  const previewRows = $derived(threads.map(inboxPreviewFromThread));
</script>

<ProjectDashShell title="Inbox" lede="Messages from people who support Grove.">
  <div class="pl-grid-2">
    <aside class="pl-surface" style="padding: 0.5rem 0;">
      <ul style="list-style: none; margin: 0; padding: 0;">
        {#each previewRows as row (row.id)}
          <li>
            <button
              type="button"
              class="pl-focus-ring"
              style="width: 100%; text-align: left; display: grid; grid-template-columns: 2.25rem 1fr auto; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border: 0; border-bottom: 1px solid var(--pl-border); background: {row.id === selectedId ? 'var(--pl-canvas-subtle)' : 'transparent'}; cursor: pointer; color: inherit;"
              onclick={() => (selectedId = row.id)}
            >
              <span
                aria-hidden="true"
                style="width: 2.25rem; height: 2.25rem; border-radius: 999px; background: var(--pl-canvas-subtle); border: 1px solid var(--pl-border); display: flex; align-items: center; justify-content: center; font-family: var(--pl-font-ui); font-weight: 600; color: var(--pl-forest);"
              >
                {row.initial}
              </span>
              <div style="min-width: 0;">
                <div class="pl-row" style="gap: 0.4rem;">
                  <strong style="font-size: 0.875rem;">{row.name}</strong>
                  {#if row.unread}
                    <span class="pl-badge pl-badge--forest">new</span>
                  {/if}
                </div>
                <p class="pl-muted" style="margin: 0.15rem 0 0; font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  {row.snippet}
                </p>
              </div>
              <div style="text-align: right;">
                <div style="font-variant-numeric: tabular-nums; font-weight: 600; font-size: 0.8125rem; color: var(--pl-ink);">{row.amount}</div>
                <time class="pl-muted" style="font-size: 0.75rem;">{row.time}</time>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    </aside>
    <ThreadView thread={selected} />
  </div>
</ProjectDashShell>
