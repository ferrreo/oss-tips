<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import { demoProject, demoGoals, formatMoney } from '../../fixtures/demo.js';

  interface Props {
    slug?: string;
  }

  let { slug = 'infrastructure-upgrade' }: Props = $props();

  function requireGoal(goalSlug: string) {
    const found = demoGoals.find((item) => item.slug === goalSlug);
    if (!found) throw new Error(`Grove demo goal missing: ${goalSlug}`);
    return found;
  }

  const goal = $derived(requireGoal(slug));
  const remainingMinor = $derived(goal.targetMinor - goal.raisedMinor);

  const notes = [
    'Uses settled project support before Stripe and oss.tips fees.',
    'Excludes the optional supporter tip to oss.tips.',
    'Refunds and chargebacks reduce the raised total.',
  ];
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
        <GoalProgress {goal} />
      </div>
      <p style="margin-bottom: 1rem;">
        {formatMoney(remainingMinor, goal.currency)} remaining
        {#if goal.deadline}
          before {goal.deadline}
        {/if}
        · counted {goal.basis}.
      </p>
      <ul class="pl-muted" style="padding-left: 1.25rem; margin-bottom: 1.5rem;">
        {#each notes as note (note)}
          <li>{note}</li>
        {/each}
      </ul>
      <a class="pl-btn pl-btn--primary pl-focus-ring" href="/{demoProject.slug}/support">Support this goal</a>
    </div>
  </main>
  <PublicFooter />
</div>
