<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';

  interface Props {
    navGroups: NavGroup[];
    title?: string;
    children?: Snippet;
  }

  let { navGroups, title, children }: Props = $props();
</script>

<div class="pl-admin">
  <aside class="pl-admin__sidebar" aria-label="Platform admin navigation">
    <div style="padding: 0 1rem 1rem;">
      <strong class="pl-admin__accent" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">Platform admin</strong>
      <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 0.25rem;">oss.tips operations</p>
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
