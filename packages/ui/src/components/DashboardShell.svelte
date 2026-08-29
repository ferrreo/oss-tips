<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';

  interface Props {
    projectName: string;
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
    children?: Snippet;
  }

  let { projectName, navGroups, title, lede, children }: Props = $props();
</script>

<div class="pl-dashboard">
  <a class="pl-skip-link" href="#main-content">Skip to content</a>
  <aside class="pl-dashboard__sidebar" aria-label="Project dashboard navigation">
    <div class="pl-dashboard__brand">
      <p class="pl-dashboard__overline">Project dashboard</p>
      <strong class="pl-dashboard__project">{projectName}</strong>
    </div>
    <SidebarNav groups={navGroups} />
  </aside>
  <main class="pl-dashboard__main" id="main-content">
    {#if title}
      <header class="pl-dashboard__header">
        <h1 class="pl-dashboard__title">{title}</h1>
        {#if lede}
          <p class="pl-dashboard__lede">{lede}</p>
        {/if}
      </header>
    {/if}
    {@render children?.()}
  </main>
</div>
