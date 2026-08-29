<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import Badge from '../../components/Badge.svelte';
  import { featuredProjects, formatMoney, type Project } from '../../fixtures/demo.js';

  const pageDemo = {
    strapline: 'Open source thrives with you.',
    support: 'Direct support for the tools you rely on. Clear fees. No hidden platform balance.',
    cadences: [
      { name: 'One-off', body: 'Send any amount from $2. Some projects grant temporary access with that payment.' },
      { name: 'Monthly', body: 'A membership that renews each month. Cancel any time; access lasts through the paid period.' },
      { name: 'Annual', body: 'A year of support at the project’s annual price, with the same rewards as monthly.' },
    ],
    projects: [
      ...featuredProjects,
      {
        slug: 'river-md',
        name: 'river-md',
        description: 'Markdown editor with gated posts and RSS.',
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
  };
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="home-hero">
      <div class="pl-container">
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
          <a class="pl-btn pl-btn--primary pl-focus-ring" href="/explore">Explore projects</a>
          <a class="pl-btn pl-btn--secondary pl-focus-ring" href="/about">How oss.tips works</a>
        </div>
      </div>
    </section>
    <HeroLandscape />

    <section class="pl-section">
      <div class="pl-container">
        <h2 class="pl-display" style="font-size: 1.5rem; margin-bottom: 1rem;">Featured projects</h2>
        <p class="pl-page-lead" style="margin-bottom: 1.5rem; font-size: 1rem;">
          Hand-picked by the team. We do not rank projects by how much money they raise.
        </p>
        <div class="home-projects">
          {#each pageDemo.projects as project (project.slug)}
            <article class="pl-surface" style="padding: 1.25rem;">
              <div class="pl-row" style="margin-bottom: 0.5rem;">
                <a href="/{project.slug}"><strong>{project.name}</strong></a>
                {#if project.verified}
                  <Badge variant="forest">Verified</Badge>
                {/if}
              </div>
              <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;">{project.description}</p>
              <p class="pl-mono pl-muted" style="font-size: 0.8125rem; margin-bottom: 0.75rem;">{project.repository}</p>
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
    font-size: clamp(2rem, 5vw, 3.25rem);
    max-width: 36rem;
    margin-bottom: 1rem;
  }

  .home-projects {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .home-panel {
    margin-top: 3rem;
    padding: 1.5rem;
    background: var(--pl-surface);
    border: 1px solid var(--pl-border);
    border-radius: var(--pl-radius-lg);
  }

  .home-cadences {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
</style>
