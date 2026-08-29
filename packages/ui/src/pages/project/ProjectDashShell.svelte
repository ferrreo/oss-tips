<script lang="ts">
  import type { Snippet } from 'svelte';
  import DashboardShell from '../../components/DashboardShell.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';

  interface Props {
    title?: string;
    lede?: string;
    children?: Snippet;
  }

  let { title, lede, children }: Props = $props();
</script>

<div class="project-dash">
  <DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} {title} {lede}>
    {@render children?.()}
  </DashboardShell>
</div>

<style>
  /* Local only: dashboard titles stay UI sans. W1 owns global tokens. */
  .project-dash :global(.pl-dashboard__title),
  .project-dash :global(.pl-dashboard__main h2),
  .project-dash :global(.pl-dashboard__main h3) {
    font-family: var(--pl-font-ui);
    font-weight: 600;
  }

  .project-dash :global(.pl-dashboard__lede) {
    color: var(--pl-ink);
  }
</style>
