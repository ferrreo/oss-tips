<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import ChartPlaceholder from '../../components/ChartPlaceholder.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import { demoProject, projectNavGroups, formatMoney } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Analytics">
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    <DataCard label="Net revenue (30d)" value={formatMoney(1587000)} compare="+12%" compareDirection="up" />
    <DataCard label="New supporters" value="24" compare="+4 vs prior" compareDirection="up" />
    <DataCard label="Churn" value="2.1%" compareDirection="down" />
  </div>
  <ChartPlaceholder label="Revenue — one-off vs recurring" range="Last 30 days · Europe/London" />
  <ChartPlaceholder label="Supporter growth" range="Last 90 days" style="margin-top: 1rem;" />
</DashboardShell>
