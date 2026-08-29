<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Badge from '../../components/Badge.svelte';
  import {
    demoProject,
    demoTiers,
    demoGoals,
    demoSupporters,
    demoPosts,
    formatMoney,
  } from '../../fixtures/demo.js';

  function requireGoal() {
    const goal = demoGoals.find((item) => item.slug === 'infrastructure-upgrade');
    if (!goal) throw new Error('Grove demo goal infrastructure-upgrade is missing');
    return goal;
  }

  const pageDemo = {
    community: [
      { label: 'Discord', href: 'https://discord.gg/grove' },
      { label: 'Docs', href: 'https://grove.dev/docs' },
      { label: 'Mastodon', href: 'https://fosstodon.org/@grove' },
    ],
    stats: [
      {
        label: 'Active supporters',
        value: String(demoProject.stats.supporters),
        compare: 'Public count',
        sparkline: [210, 228, 241, 255, 268, 284],
      },
      {
        label: 'Monthly recurring',
        value: formatMoney(demoProject.stats.monthlyRecurringMinor, demoProject.currency),
        compare: 'Settled, before fees',
        sparkline: [4100, 4550, 5020, 5480, 6010, 6421],
      },
      {
        label: 'One-off this month',
        value: formatMoney(demoProject.stats.oneOffThisMonthMinor, demoProject.currency),
        compare: 'Project-selected stat',
        sparkline: [1800, 2400, 3100, 4200, 5100, 6420],
      },
    ],
    thanks: demoSupporters.filter((supporter) => supporter.public && supporter.message),
    embed: '<script async src="https://oss.tips/widgets/grove/thanks.js"><\/script>',
    goal: requireGoal(),
  };

  let selectedTier = $state('supporter');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <HeroLandscape />
    <div class="pl-container" style="padding-top: 0.5rem; padding-bottom: 3rem;">
      <div class="pp-identity">
        <ProjectHero project={demoProject} />
        <div class="pl-row" style="flex-wrap: wrap; margin-top: 0.25rem;">
          {#each pageDemo.community as link (link.href)}
            <a href={link.href}>{link.label}</a>
          {/each}
        </div>
        <div class="pl-row" style="margin-top: 1.25rem; flex-wrap: wrap;">
          <a class="pl-btn pl-btn--primary pl-focus-ring" href="#support">Support {demoProject.name}</a>
          <a class="pl-btn pl-btn--secondary pl-focus-ring" href="#updates">Read updates</a>
        </div>
      </div>

      <div id="support" class="pp-compose">
        <SupportComposer tiers={demoTiers} currency={demoProject.currency} />
        <GoalProgress goal={pageDemo.goal} />
      </div>

      <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 1rem;">Membership tiers</h2>
      <div class="pp-tiers">
        {#each demoTiers as tier (tier.id)}
          <TierCard
            {tier}
            currency={demoProject.currency}
            selected={selectedTier === tier.id}
            onclick={() => (selectedTier = tier.id)}
          />
        {/each}
      </div>

      <div id="updates" class="pp-feed">
        <section>
          <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Recent updates</h2>
          {#each demoPosts as post (post.id)}
            <article class="pp-update">
              <div class="pl-row" style="margin-bottom: 0.25rem; flex-wrap: wrap;">
                <h3 style="font-size: 1rem;">
                  <a href="/{demoProject.slug}/posts/{post.slug}">{post.title}</a>
                </h3>
                <Badge>{post.tierVisibility}</Badge>
              </div>
              <p class="pl-muted" style="font-size: 0.875rem;">{post.excerpt}</p>
              <p class="pl-muted" style="font-size: 0.8125rem; margin: 0.25rem 0 0;">
                {post.publishedLabel} · {post.author}
              </p>
            </article>
          {/each}
        </section>
        <SupporterWall supporters={demoSupporters} currency={demoProject.currency} />
        <section>
          <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Project stats</h2>
          <div class="pl-stack">
            {#each pageDemo.stats as stat (stat.label)}
              <DataCard
                label={stat.label}
                value={stat.value}
                compare={stat.compare}
                sparkline={stat.sparkline}
              />
            {/each}
          </div>
        </section>
      </div>

      <section class="pp-thanks" aria-label="Thanks widget">
        <div class="pl-row pl-row--between" style="margin-bottom: 1rem; flex-wrap: wrap;">
          <div>
            <h2 class="pl-display" style="font-size: 1.125rem;">Thanks</h2>
            <p class="pl-muted" style="font-size: 0.875rem; margin-top: 0.25rem;">
              Public notes left with support. Amounts stay hidden unless a supporter opts in.
            </p>
          </div>
          <Badge variant="forest">Embeddable widget</Badge>
        </div>
        <div class="pp-thanks__grid">
          {#each pageDemo.thanks as note (note.id)}
            <article class="pp-thanks__note">
              <p style="font-size: 0.9375rem; margin: 0 0 0.75rem;">"{note.message}"</p>
              <p class="pl-muted" style="font-size: 0.8125rem; margin: 0;">
                {note.displayName} · {note.tierName} · {note.relativeTime}
              </p>
            </article>
          {/each}
        </div>
        <p class="pl-mono pl-muted" style="font-size: 0.8125rem; margin-top: 1rem; overflow-wrap: anywhere;">
          {pageDemo.embed}
        </p>
      </section>

      <p class="pl-muted" style="font-size: 0.875rem; margin-top: 2rem;">
        Secure payments via Stripe. {demoProject.name} is the merchant of record.
        <a href="/pricing">How fees work</a>
        ·
        <a href="/security">Report this project</a>
      </p>
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .pp-identity {
    margin-bottom: 2rem;
  }

  .pp-compose {
    display: grid;
    gap: 1.5rem;
    margin: 0 0 2.5rem;
  }

  .pp-tiers {
    display: grid;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .pp-feed {
    display: grid;
    gap: 1.5rem;
    margin-bottom: 2.5rem;
  }

  .pp-update {
    padding: 1rem 0;
    border-bottom: 1px solid var(--pl-border);
  }

  .pp-thanks {
    padding: 1.25rem;
    background: var(--pl-canvas-subtle);
    border: 1px solid var(--pl-border);
    border-radius: var(--pl-radius-lg);
  }

  .pp-thanks__grid {
    display: grid;
    gap: 1rem;
  }

  .pp-thanks__note {
    padding: 1rem;
    background: var(--pl-surface);
    border: 1px solid var(--pl-border);
    border-radius: var(--pl-radius-md);
  }

  @media (min-width: 44rem) {
    .pp-compose {
      grid-template-columns: 2fr 1fr;
    }

    .pp-tiers {
      grid-template-columns: repeat(2, 1fr);
    }

    .pp-thanks__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 72rem) {
    .pp-tiers {
      grid-template-columns: repeat(4, 1fr);
    }

    .pp-feed {
      grid-template-columns: 1.2fr 1fr 0.9fr;
    }
  }
</style>
