<script lang="ts">
  import DashboardShell from './DashboardShell.svelte';
  import type { NavGroup } from '../fixtures/demo.js';

  interface Props {
    projectName: string;
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
  }

  let { projectName, navGroups, title, lede }: Props = $props();
</script>

<DashboardShell {projectName} {navGroups} {title} {lede}>
  <p class="pl-muted">This workspace holds the numbers and queues for the selected project. Nothing here is a toast.</p>
</DashboardShell>
