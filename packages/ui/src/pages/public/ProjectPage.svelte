<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
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
    goal: demoGoals.find((goal) => goal.slug === 'infrastructure-upgrade'),
  };

  let selectedTier = $state('supporter');
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <figure class="pp-landscape" aria-hidden="true">
      <svg viewBox="0 0 1600 280" fill="none">
        <rect width="1600" height="280" fill="var(--pl-canvas-subtle)" />
        <path d="M0 190 C220 150 380 220 620 170 C860 120 1100 210 1600 150 L1600 280 L0 280 Z" fill="var(--pl-fern)" opacity="0.35" />
        <path d="M0 220 C280 180 520 240 820 200 C1120 160 1340 230 1600 190 L1600 280 L0 280 Z" fill="var(--pl-moss)" opacity="0.28" />
        <path d="M180 200 C230 120 320 110 360 190 C320 165 250 175 180 200 Z" fill="var(--pl-forest)" opacity="0.55" />
        <path d="M330 210 C410 115 520 105 560 200 C500 165 410 180 330 210 Z" fill="var(--pl-forest)" opacity="0.7" />
        <circle cx="1280" cy="72" r="28" fill="var(--pl-ochre)" opacity="0.4" />
      </svg>
    </figure>
    <div class="pl-container" style="padding-top: 0.5rem; padding-bottom: 3rem;">
      <div class="pp-identity">
        <ProjectHero project={demoProject} />
        <div class="pl-row" style="flex-wrap: wrap; margin-top: 0.25rem;">
          {#each pageDemo.community as link (link.href)}
            <a href={link.href}>{link.label}</a>
          {/each}
        </div>
      </div>

      <div class="pp-compose">
        <SupportComposer tiers={demoTiers} currency={demoProject.currency} />
        {#if pageDemo.goal}
          <GoalProgress goal={pageDemo.goal} />
        {/if}
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

      <div class="pp-feed">
        <section>
          <h2 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.75rem;">Recent updates</h2>
          {#each demoPosts as post (post.id)}
            <article class="pp-update">
              <div class="pl-row" style="margin-bottom: 0.25rem; flex-wrap: wrap;">
                <h3 style="font-size: 1rem;">{post.title}</h3>
                <Badge>{post.tierVisibility}</Badge>
              </div>
              <p class="pl-muted" style="font-size: 0.875rem;">{post.excerpt}</p>
              <a href="/{demoProject.slug}/posts/{post.slug}" style="font-size: 0.8125rem;">
                {post.publishedLabel} · {post.author}
              </a>
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
        <p class="pl-mono pl-muted" style="font-size: 0.75rem; margin-top: 1rem; overflow-wrap: anywhere;">
          {pageDemo.embed}
        </p>
      </section>

      <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 2rem;">
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
  .pp-landscape {
    margin: 0;
  }

  .pp-landscape svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: 14rem;
  }

  .pp-identity {
    margin-bottom: 0.5rem;
  }

  .pp-compose {
    display: grid;
    gap: 1.5rem;
    margin: 1.5rem 0 2.5rem;
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
