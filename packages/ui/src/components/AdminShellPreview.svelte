<script lang="ts">
  import AdminShell from './AdminShell.svelte';
  import { adminNavGroups } from '../fixtures/demo.js';

  interface Props {
    title?: string;
    lede?: string;
    projectContext?: string;
  }

  let {
    title = 'Overview',
    lede = 'Review queue, settlement volume, and failed jobs.',
    projectContext = 'Acting on Grove. Refunds and restrictions stay on this project.',
  }: Props = $props();
</script>

<AdminShell navGroups={adminNavGroups} {title} {lede} {projectContext}>
  <p class="pl-muted">
    Pick Review, Directory, Reconciliation, Cases, or Audit log from the sidebar. This preview has no page body so the
    sidebar and header can be checked on their own.
  </p>
</AdminShell>
