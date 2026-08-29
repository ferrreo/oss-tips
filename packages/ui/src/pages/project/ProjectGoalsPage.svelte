<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoGoals, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Goals">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Fundraising targets with explicit basis and deadlines.</p>
    <Button variant="primary">Add goal</Button>
  </div>
  <div class="pl-stack">
    {#each demoGoals as goal (goal.id)}
      <GoalProgress goal={goal} />
    {/each}
  </div>
</DashboardShell>
