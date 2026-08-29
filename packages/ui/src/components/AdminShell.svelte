<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';

  interface Props {
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
    projectContext?: string;
    children?: Snippet;
  }

  let { navGroups, title, lede, projectContext, children }: Props = $props();
</script>

<div class="pl-admin">
  <a class="pl-skip-link" href="#main-content">Skip to content</a>
  <aside class="pl-admin__sidebar" aria-label="Platform admin navigation">
    <div class="pl-admin__brand">
      <p class="pl-admin__accent">Platform admin</p>
      <p class="pl-admin__sub">oss.tips operations</p>
    </div>
    <SidebarNav groups={navGroups} />
  </aside>
  <main class="pl-dashboard__main" id="main-content">
    {#if title}
      <header class="pl-dashboard__header">
        <p class="pl-admin__context">
          {projectContext ?? 'No project selected. Actions that change money need an explicit project.'}
        </p>
        <h1 class="pl-dashboard__title">{title}</h1>
        {#if lede}
          <p class="pl-dashboard__lede">{lede}</p>
        {/if}
      </header>
    {/if}
    {@render children?.()}
  </main>
</div>
