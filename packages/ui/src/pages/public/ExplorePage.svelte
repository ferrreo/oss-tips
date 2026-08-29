<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Badge from '../../components/Badge.svelte';
  import { featuredProjects, formatMoney, type Project } from '../../fixtures/demo.js';

  const pageDemo = {
    filters: [
      { id: 'goals', label: 'Active goals' },
      { id: 'recurring', label: 'Recurring support' },
      { id: 'updated', label: 'Recently updated' },
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
      {
        slug: 'seed-bot',
        name: 'seed-bot',
        description: 'Discord roles that follow membership status.',
        website: 'https://seed-bot.dev',
        repository: 'github.com/oss-tips/seed-bot',
        verified: false,
        currency: 'USD',
        feeMode: 'project_5pct' as const,
        logoLetter: 'S',
        tags: ['discord', 'bot'],
        stats: {
          supporters: 67,
          monthlyRecurringMinor: 180000,
          oneOffThisMonthMinor: 24000,
          totalSupportMinor: 204000,
        },
      },
    ] satisfies Project[],
  };

  let search = $state('');
  let activeFilter = $state<string | null>(null);

  const visible = $derived(
    pageDemo.projects.filter((project) => {
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.repository.toLowerCase().includes(q) ||
        project.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (activeFilter === 'goals') return project.slug === 'grove' || project.slug === 'vitest-run';
      if (activeFilter === 'recurring') return project.stats.monthlyRecurringMinor > 0;
      if (activeFilter === 'updated') return project.verified;
      return true;
    }),
  );
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="pl-public-hero">
      <div class="pl-container">
        <p class="pl-public-hero__brand">oss.tips</p>
        <h1 class="pl-display pl-public-hero__title">Explore projects</h1>
        <p class="pl-page-lead">
          Search by name, repository, or tag. Ranking prefers exact name matches and recent project activity, not payment
          volume.
        </p>
      </div>
    </section>
    <section class="pl-section" style="padding-top: 0;">
      <div class="pl-container">
        <div class="ex-search">
          <TextField
            label="Search projects"
            name="explore-search"
            bind:value={search}
            placeholder="Grove, vitest-run, github.com/…"
            type="search"
          />
          <div class="pl-row" style="flex-wrap: wrap; padding-top: 1.75rem;" role="group" aria-label="Filter projects">
            {#each pageDemo.filters as filter (filter.id)}
              <button
                type="button"
                class="ex-chip pl-focus-ring"
                aria-pressed={activeFilter === filter.id}
                onclick={() => (activeFilter = activeFilter === filter.id ? null : filter.id)}
              >
                {filter.label}
              </button>
            {/each}
          </div>
        </div>
        <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 1rem;">{visible.length} projects</p>
        <div class="pl-stack">
          {#each visible as project (project.slug)}
            <article class="pl-surface" style="padding: 1.25rem;">
              <div class="ex-row">
                <div>
                  <div class="pl-row" style="margin-bottom: 0.25rem;">
                    <h2 style="font-size: 1.125rem;">
                      <a href="/{project.slug}">{project.name}</a>
                    </h2>
                    {#if project.verified}
                      <Badge variant="forest">Verified</Badge>
                    {/if}
                  </div>
                  <p class="pl-muted" style="font-size: 0.875rem;">{project.description}</p>
                </div>
                <div class="ex-meta">
                  <p class="pl-mono" style="font-size: 0.8125rem;">{project.repository}</p>
                  <p class="pl-muted" style="font-size: 0.8125rem;">
                    {project.stats.supporters} supporters · {formatMoney(project.stats.monthlyRecurringMinor, project.currency)}/mo
                  </p>
                </div>
              </div>
              <div class="pl-row" style="margin-top: 0.75rem; flex-wrap: wrap;">
                {#each project.tags as tag (tag)}
                  <Badge>{tag}</Badge>
                {/each}
              </div>
            </article>
          {/each}
        </div>
      </div>
    </section>
  </main>
  <PublicFooter />
</div>

<style>
  .ex-search {
    display: grid;
    gap: 1rem;
    margin: 0 0 1rem;
  }

  .ex-chip {
    min-height: var(--pl-touch);
    padding: 0 0.875rem;
    border-radius: 999px;
    border: 1px solid var(--pl-border);
    background: var(--pl-surface);
    color: var(--pl-ink);
    font: inherit;
    cursor: pointer;
  }

  .ex-chip[aria-pressed='true'] {
    border-color: var(--pl-forest);
    color: var(--pl-forest);
    background: color-mix(in srgb, var(--pl-forest) 8%, var(--pl-surface));
  }

  .ex-row {
    display: grid;
    gap: 1rem;
  }

  .ex-meta {
    text-align: left;
  }

  @media (min-width: 44rem) {
    .ex-search {
      grid-template-columns: 1fr auto;
    }

    .ex-row {
      grid-template-columns: 1fr auto;
    }

    .ex-meta {
      text-align: right;
    }
  }
</style>
