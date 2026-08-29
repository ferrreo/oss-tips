<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, demoGoals, projectNavGroups, formatMoney, formatPercent } from '../../fixtures/demo.js';
  import { extraGoals } from './project-demo.js';

  const allGoals = [...demoGoals, ...extraGoals];
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Goals">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Fundraising targets with explicit basis and deadlines.</p>
    <Button variant="primary">Add goal</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <div class="pl-stack">
      <TextField label="Goal title" value="Community illustration pack" />
      <TextField label="Target" value="£2,500" help="Shown as before-fees unless you change the basis." />
      <TextField label="Deadline" value="2026-12-01" />
    </div>
  </div>
  <div class="pl-stack" style="margin-bottom: 1.5rem;">
    {#each allGoals as goal (goal.id)}
      <GoalProgress {goal} />
    {/each}
  </div>
  <Table
    caption="All goals"
    columns={[
      { key: 'title', label: 'Goal' },
      { key: 'raised', label: 'Raised' },
      { key: 'target', label: 'Target' },
      { key: 'percent', label: 'Progress' },
      { key: 'basis', label: 'Basis' },
    ]}
    rows={allGoals.map((goal) => ({
      title: goal.title,
      raised: formatMoney(goal.raisedMinor, goal.currency),
      target: formatMoney(goal.targetMinor, goal.currency),
      percent: `${formatPercent(goal.raisedMinor, goal.targetMinor)}%`,
      basis: goal.basis,
    }))}
  />
</DashboardShell>
