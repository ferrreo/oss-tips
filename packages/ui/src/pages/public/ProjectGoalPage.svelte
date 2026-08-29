<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoGoals, formatMoney } from '../../fixtures/demo.js';

  const goal = demoGoals.find((item) => item.slug === 'infrastructure-upgrade');

  const pageDemo = {
    notes: [
      'Uses settled project support before Stripe and oss.tips fees.',
      'Excludes the optional supporter tip to oss.tips.',
      'Refunds and chargebacks reduce the raised total.',
    ],
    remainingMinor: goal ? goal.targetMinor - goal.raisedMinor : 0,
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-muted" style="margin-bottom: 0.5rem;">
        <a href="/{demoProject.slug}">{demoProject.name}</a> / Goals
      </p>
      {#if goal}
        <h1 class="pl-page-title">{goal.title}</h1>
        <p class="pl-page-lead">{goal.description}</p>
        <div style="margin: 2rem 0;">
          <GoalProgress {goal} />
        </div>
        <p style="margin-bottom: 1rem;">
          {formatMoney(pageDemo.remainingMinor, goal.currency)} remaining
          {#if goal.deadline}
            before {goal.deadline}
          {/if}
          · basis {goal.basis}.
        </p>
      {/if}
      <ul class="pl-muted" style="padding-left: 1.25rem; margin-bottom: 1.5rem;">
        {#each pageDemo.notes as note (note)}
          <li>{note}</li>
        {/each}
      </ul>
      <Button variant="primary">Support this goal</Button>
    </div>
  </main>
  <PublicFooter />
</div>
