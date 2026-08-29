<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import {
    demoProject,
    demoTiers,
    demoGoals,
    demoSupporters,
    demoPosts,
    formatMoney,
  } from '../../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <div class="pl-container" style="padding-top: 1rem;">
      <ProjectHero project={demoProject} />
      <div class="pl-grid-2" style="margin-bottom: 2rem;">
        <SupportComposer currency={demoProject.currency} />
        <GoalProgress goal={demoGoals[0]} />
      </div>
      <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 1rem;">Membership tiers</h2>
      <div class="pl-grid-3" style="margin-bottom: 2rem;">
        {#each demoTiers as tier (tier.id)}
          <TierCard tier={tier} currency={demoProject.currency} />
        {/each}
      </div>
      <div class="pl-grid-2">
        <section>
          <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Recent updates</h2>
          {#each demoPosts as post (post.id)}
            <article style="padding: 1rem 0; border-bottom: 1px solid var(--pl-border);">
              <h3 style="font-size: 1rem;">{post.title}</h3>
              <p class="pl-muted" style="font-size: 0.875rem;">{post.excerpt}</p>
              <span class="pl-muted" style="font-size: 0.75rem;">{post.publishedAt} · {post.tierVisibility}</span>
            </article>
          {/each}
        </section>
        <div class="pl-stack">
          <SupporterWall supporters={demoSupporters} currency={demoProject.currency} />
          <section class="pl-surface" style="padding: 1rem;">
            <h3 style="font-size: 0.875rem; margin-bottom: 0.5rem;">Project stats</h3>
            <p class="pl-muted" style="font-size: 0.875rem;">
              {demoProject.stats.supporters} supporters · {formatMoney(demoProject.stats.monthlyRecurringMinor, demoProject.currency)}/mo recurring
            </p>
          </section>
        </div>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
