<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { adminNavGroups } from '../../fixtures/demo.js';
</script>

<AdminShell navGroups={adminNavGroups} title="Platform overview">
  <StatusBanner variant="info" title="7 projects in review queue" message="First-payment activation and duplicate repository claims." />
  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="Published projects" value="1,248" compare="+12 this month" compareDirection="up" />
    <DataCard label="Review queue" value="7" compare="Action needed" />
    <DataCard label="Open cases" value="2" compare="Abuse & recovery" />
  </div>
  <div class="pl-grid-2">
    <DataCard label="Settlement volume (30d)" value="£2.4M" />
    <DataCard label="Failed webhook jobs" value="14" compare="-3 vs yesterday" compareDirection="down" />
  </div>
</AdminShell>
