<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import { demoProject, demoThreads, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Inbox">
  <div class="pl-grid-2">
    <aside>
      <ul style="list-style: none; padding: 0;">
        {#each demoThreads as thread (thread.id)}
          <li style="padding: 0.75rem; border-bottom: 1px solid var(--pl-border);">
            <strong style="font-size: 0.875rem;">{thread.subject}</strong>
            {#if thread.unread}
              <span class="pl-badge pl-badge--forest" style="margin-left: 0.5rem;">new</span>
            {/if}
          </li>
        {/each}
      </ul>
    </aside>
    <ThreadView thread={demoThreads[0]} />
  </div>
</DashboardShell>
