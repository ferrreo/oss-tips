<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoGoals } from '../../fixtures/demo.js';

  const goal = demoGoals[0];
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-muted" style="margin-bottom: 0.5rem;">
        <a href="/{demoProject.slug}">{demoProject.name}</a> / Goals
      </p>
      <h1 class="pl-page-title">{goal.title}</h1>
      <p class="pl-page-lead">{goal.description}</p>
      <div style="margin: 2rem 0;">
        <GoalProgress goal={goal} />
      </div>
      <Button variant="primary">Support this goal</Button>
    </div>
  </main>
  <PublicFooter />
</div>
