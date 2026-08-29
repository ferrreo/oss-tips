<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';

  interface Props {
    projectName: string;
    navGroups: NavGroup[];
    title?: string;
    children?: Snippet;
  }

  let { projectName, navGroups, title, children }: Props = $props();
</script>

<div class="pl-dashboard">
  <aside class="pl-dashboard__sidebar" aria-label="Project dashboard navigation">
    <div style="padding: 0 1rem 1rem;">
      <strong class="pl-display" style="font-size: 1rem;">{projectName}</strong>
    </div>
    <SidebarNav groups={navGroups} />
  </aside>
  <main class="pl-dashboard__main" id="main-content">
    {#if title}
      <header class="pl-dashboard__header">
        <h1 class="pl-dashboard__title">{title}</h1>
      </header>
    {/if}
    {@render children?.()}
  </main>
</div>
