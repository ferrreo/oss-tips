<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import SupportOverTimeChart from './SupportOverTimeChart.svelte';
  import {
    analyticsBreakdown,
    supportOverTimeLabels,
    supportOverTimeSeries,
    supporterGrowthSeries,
  } from './project-demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Analytics">
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    <DataCard label="Total support" value="$12,841" compare="+18.2%" compareDirection="up" />
    <DataCard label="New supporters" value="284" compare="+24.1%" compareDirection="up" />
    <DataCard label="MRR" value="$6,421" compare="+22.7%" compareDirection="up" />
  </div>
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    <DataCard label="Net after fees (30d)" value="$12,327" compare="Fees $514" />
    <DataCard label="Refunds" value="$48" compare="2 cases" compareDirection="down" />
    <DataCard label="Churn" value="2.1%" compare="-0.4 pts" compareDirection="down" />
  </div>

  <SupportOverTimeChart
    title="Support over time"
    range="Last 12 months · Europe/London"
    labels={supportOverTimeLabels}
    series={supportOverTimeSeries}
  />

  <div style="margin-top: 1.5rem;">
    <SupportOverTimeChart
      title="Supporter growth"
      range="Last 12 months · Europe/London"
      labels={supportOverTimeLabels}
      series={supporterGrowthSeries}
      valuePrefix=""
    />
  </div>

  <h2 class="pl-display" style="font-size: 1.125rem; margin: 1.5rem 0 0.75rem;">Revenue mix</h2>
  <Table
    caption="Gross, fees, and net by source"
    columns={[
      { key: 'source', label: 'Source' },
      { key: 'gross', label: 'Gross' },
      { key: 'fees', label: 'Fees' },
      { key: 'net', label: 'Net' },
      { key: 'share', label: 'Share' },
    ]}
    rows={analyticsBreakdown}
  />
</DashboardShell>
