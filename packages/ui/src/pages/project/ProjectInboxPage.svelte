<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import { demoProject, demoThreads, projectNavGroups } from '../../fixtures/demo.js';
  import { extraThreads, inboxPreviewRows } from './project-demo.js';

  const threads = [...demoThreads, ...extraThreads];
  let selectedId = $state(threads[0].id);
  const selected = $derived(threads.find((thread) => thread.id === selectedId) ?? threads[0]);
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Inbox">
  <div class="pl-grid-2">
    <aside class="pl-surface" style="padding: 0.5rem 0;">
      <ul style="list-style: none; margin: 0; padding: 0;">
        {#each inboxPreviewRows as row, index (row.id)}
          <li>
            <button
              type="button"
              class="pl-focus-ring"
              style="width: 100%; text-align: left; display: grid; grid-template-columns: 2.25rem 1fr auto; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border: 0; border-bottom: 1px solid var(--pl-border); background: {threads[index]?.id === selectedId ? 'var(--pl-canvas-subtle)' : 'transparent'}; cursor: pointer; color: inherit;"
              onclick={() => (selectedId = threads[index]?.id ?? selectedId)}
            >
              <span
                aria-hidden="true"
                style="width: 2.25rem; height: 2.25rem; border-radius: 999px; background: var(--pl-canvas-subtle); border: 1px solid var(--pl-border); display: flex; align-items: center; justify-content: center; font-family: var(--pl-font-display); color: var(--pl-forest);"
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
                <div style="font-variant-numeric: tabular-nums; font-weight: 600; font-size: 0.8125rem;">{row.amount}</div>
                <time class="pl-muted" style="font-size: 0.75rem;">{row.time}</time>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    </aside>
    <ThreadView thread={selected} />
  </div>
</DashboardShell>
