<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import ThreadView from '../../components/ThreadView.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import {
    demoProject,
    demoGoals,
    demoThreads,
    projectNavGroups,
    formatMoney,
  } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Overview">
  <StatusBanner variant="warning" title="Stripe verification incomplete" message="Payments disabled until charges_enabled is active." />
  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="MRR" value={formatMoney(demoProject.stats.monthlyRecurringMinor)} compare="+8% vs last month" compareDirection="up" />
    <DataCard label="Supporters" value={String(demoProject.stats.supporters)} compare="+6 this month" compareDirection="up" />
    <DataCard label="Unanswered inbox" value="3" compare="Action needed" />
  </div>
  <div class="pl-grid-2">
    <GoalProgress goal={demoGoals[0]} />
    <section>
      <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Inbox preview</h2>
      <ThreadView thread={demoThreads[0]} />
    </section>
  </div>
</DashboardShell>
