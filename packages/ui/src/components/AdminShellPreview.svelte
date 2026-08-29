<script lang="ts">
  import AdminShell from './AdminShell.svelte';
  import type { NavGroup } from '../fixtures/demo.js';

  interface Props {
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
    projectContext?: string;
  }

  let { navGroups, title, lede, projectContext }: Props = $props();
</script>

<AdminShell {navGroups} {title} {lede} {projectContext}>
  <p class="pl-muted">Refunds and restrictions stay scoped to the project named in the header.</p>
</AdminShell>
