<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import { featuredProjects, formatMoney, type Project } from '../../fixtures/demo.js';

  const pageDemo = {
    overline: 'oss.tips · Paperlight',
    strapline: 'Open source thrives with you.',
    support:
      'Direct support for the tools you rely on. One-off gifts and memberships with clear fees. No hidden platform balance.',
    cadences: [
      {
        name: 'One-off',
        body: 'Gift any amount from $2. Optional entitlements last 30 days, 90 days, a year, or permanently when the project says so.',
      },
      {
        name: 'Monthly',
        body: 'Recurring memberships with cumulative tier rewards. Cancel any time. Access continues to the paid period end.',
      },
      {
        name: 'Annual',
        body: 'A year of support at the project explicit annual price. The same rewards as monthly, without a silent discount.',
      },
    ],
    projects: [
      ...featuredProjects,
      {
        slug: 'river-md',
        name: 'river-md',
        description: 'Deterministic Markdown round-trip for gated posts and RSS.',
        website: 'https://river-md.dev',
        repository: 'github.com/oss-tips/river-md',
        verified: true,
        currency: 'USD',
        feeMode: 'standard' as const,
        logoLetter: 'R',
        tags: ['markdown', 'editor'],
        stats: {
          supporters: 156,
          monthlyRecurringMinor: 410000,
          oneOffThisMonthMinor: 78000,
          totalSupportMinor: 488000,
        },
      },
    ] satisfies Project[],
    counters: [
      { label: 'Projects published', value: '1,248', compare: 'Settled directory', sparkline: [980, 1040, 1112, 1180, 1220, 1248] },
      { label: 'Support processed (30d)', value: '$2.4M', compare: 'After Stripe settlement', sparkline: [18, 19, 21, 20, 23, 24] },
      { label: 'Median project fee', value: '5.0%', compare: 'Standard mode', sparkline: [5, 5, 5, 5, 5, 5] },
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="home-hero">
      <div class="pl-container">
        <p class="home-overline">{pageDemo.overline}</p>
        <div class="home-brand">
          <svg class="home-mark" viewBox="0 0 72 72" aria-hidden="true">
            <path d="M49 22 A22 22 0 1 1 37 14" fill="none" stroke="var(--pl-forest)" stroke-width="6" stroke-linecap="round" />
            <path d="M36 16 C40 7 51 8 53 17 C47 21 41 20 36 16 Z" fill="var(--pl-moss)" />
            <path d="M42 20 C50 16 57 21 55 29 C48 29 44 25 42 20 Z" fill="var(--pl-ochre)" />
            <circle cx="32" cy="33" r="3" fill="var(--pl-ink)" />
          </svg>
          <p class="home-wordmark" aria-label="oss.tips">oss.<span>tips</span></p>
        </div>
        <h1 class="pl-display home-strapline">{pageDemo.strapline}</h1>
        <p class="pl-page-lead" style="margin-bottom: 2rem;">{pageDemo.support}</p>
        <div class="pl-row" style="flex-wrap: wrap;">
          <Button variant="primary">Support a project</Button>
          <Button variant="secondary">Explore projects</Button>
        </div>
      </div>
    </section>
    <figure class="home-landscape" aria-hidden="true">
      <svg viewBox="0 0 1600 240" fill="none">
        <rect width="1600" height="240" fill="var(--pl-canvas-subtle)" />
        <path d="M0 160 C240 120 420 190 680 140 C940 90 1180 180 1600 130 L1600 240 L0 240 Z" fill="var(--pl-fern)" opacity="0.35" />
        <path d="M0 190 C300 150 560 210 860 170 C1160 130 1380 200 1600 165 L1600 240 L0 240 Z" fill="var(--pl-moss)" opacity="0.28" />
        <circle cx="1320" cy="58" r="24" fill="var(--pl-ochre)" opacity="0.4" />
      </svg>
    </figure>

    <section class="pl-section">
      <div class="pl-container">
        <h2 class="pl-display" style="font-size: 1.5rem; margin-bottom: 1rem;">Featured projects</h2>
        <p class="pl-muted" style="margin-bottom: 1.5rem; max-width: 40rem;">
          Manually curated. Payment volume is not a ranking signal.
        </p>
        <div class="home-projects">
          {#each pageDemo.projects as project (project.slug)}
            <article class="pl-surface" style="padding: 1.25rem;">
              <div class="pl-row" style="margin-bottom: 0.5rem;">
                <strong>{project.name}</strong>
                {#if project.verified}
                  <Badge variant="forest">Verified</Badge>
                {/if}
              </div>
              <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;">{project.description}</p>
              <p class="pl-mono pl-muted" style="font-size: 0.75rem; margin-bottom: 0.75rem;">{project.repository}</p>
              <p class="pl-mono" style="font-size: 0.8125rem;">
                {project.stats.supporters} supporters · {formatMoney(project.stats.monthlyRecurringMinor, project.currency)}/mo
              </p>
              <div class="pl-row" style="margin-top: 0.75rem; flex-wrap: wrap;">
                {#each project.tags as tag (tag)}
                  <Badge>{tag}</Badge>
                {/each}
              </div>
            </article>
          {/each}
        </div>

        <section class="home-panel">
          <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 0.75rem;">How support works</h2>
          <div class="home-cadences">
            {#each pageDemo.cadences as cadence (cadence.name)}
              <div>
                <strong>{cadence.name}</strong>
                <p class="pl-muted" style="font-size: 0.875rem; margin-top: 0.35rem;">{cadence.body}</p>
              </div>
            {/each}
          </div>
        </section>

        <h2 class="pl-display" style="font-size: 1.25rem; margin: 2.5rem 0 1rem;">Settled platform counters</h2>
        <div class="home-counters">
          {#each pageDemo.counters as card (card.label)}
            <DataCard label={card.label} value={card.value} compare={card.compare} sparkline={card.sparkline} />
          {/each}
        </div>
      </div>
    </section>
  </main>
  <PublicFooter />
</div>

<style>
  .home-hero {
    padding: 4.5rem 0 3rem;
    background: var(--pl-canvas);
  }

  .home-overline {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pl-ink-muted);
    margin: 0 0 1.25rem;
  }

  .home-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .home-mark {
    width: 4.5rem;
    height: 4.5rem;
    flex-shrink: 0;
  }

  .home-wordmark {
    margin: 0;
    font-family: var(--pl-font-display);
    font-size: clamp(2.75rem, 7vw, 5rem);
    font-weight: 700;
    line-height: 1;
    color: var(--pl-ink);
  }

  .home-wordmark span {
    color: var(--pl-forest);
  }

  .home-strapline {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    line-height: 1.05;
    max-width: 22ch;
    margin-bottom: 1rem;
  }

  .home-projects,
  .home-cadences,
  .home-counters {
    display: grid;
    gap: 1rem;
  }

  .home-panel {
    margin-top: 3rem;
    padding: 2rem;
    background: var(--pl-canvas-subtle);
    border-radius: var(--pl-radius-lg);
  }

  .home-landscape {
    margin: 0;
  }

  .home-landscape svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: 12rem;
  }

  @media (min-width: 44rem) {
    .home-projects,
    .home-cadences,
    .home-counters {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 72rem) {
    .home-projects {
      grid-template-columns: repeat(4, 1fr);
    }

    .home-cadences,
    .home-counters {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
