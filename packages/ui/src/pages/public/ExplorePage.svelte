<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import TextField from '../../components/TextField.svelte';
  import Badge from '../../components/Badge.svelte';
  import ProjectLogo from '../../components/ProjectLogo.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { featuredProjects, type Project } from '../../fixtures/demo.js';
  import { formatCurrency, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface ProjectFilter {
    id: string;
    label: string;
  }

  export interface Props {
    projects?: Project[];
    filters?: ProjectFilter[];
    initialSearch?: string;
    initialFilter?: string | null;
    viewState?: 'ready' | 'empty' | 'error';
  }

  const defaultProjects: Project[] = [
    ...featuredProjects,
    {
      slug: 'river-md',
      name: 'river-md',
      description: 'Markdown editor with gated posts and RSS.',
      website: 'https://river-md.dev',
      repository: 'github.com/oss-tips/river-md',
      verified: true,
      currency: 'USD',
      feeMode: 'standard',
      logoLetter: 'R',
      tags: ['markdown', 'editor'],
      stats: { supporters: 156, monthlyRecurringMinor: 410000, oneOffThisMonthMinor: 78000, totalSupportMinor: 488000 },
    },
    {
      slug: 'seed-bot',
      name: 'seed-bot',
      description: 'Discord roles that follow membership status.',
      website: 'https://seed-bot.dev',
      repository: 'github.com/oss-tips/seed-bot',
      verified: false,
      currency: 'USD',
      feeMode: 'project_5pct',
      logoLetter: 'S',
      tags: ['discord', 'bot'],
      stats: { supporters: 67, monthlyRecurringMinor: 180000, oneOffThisMonthMinor: 24000, totalSupportMinor: 204000 },
    },
  ];

  let {
    projects = defaultProjects,
    filters,
    initialSearch = '',
    initialFilter = null,
    viewState = 'ready',
  }: Props = $props();

  let search = $state(untrack(() => initialSearch));
  let activeFilter = $state<string | null>(untrack(() => initialFilter));

  const taxonomyFilters = $derived(
    [...new Map(projects.flatMap((project) => [
      ...(project.ecosystems ?? []).map((value) => [`ecosystem:${value}`, value] as const),
      ...(project.languages ?? []).map((value) => [`language:${value}`, value] as const),
      ...project.tags.map((value) => [`tag:${value}`, value] as const),
    ])).entries()]
      .map(([id, label]) => ({ id, label }))
      .slice(0, 12),
  );

  const displayFilters = $derived([
    ...(filters ?? [
      { id: 'goals', label: t('public.explore.activeGoals', {}, $locale) },
      { id: 'recurring', label: t('public.explore.recurring', {}, $locale) },
      { id: 'updated', label: t('public.explore.recentlyUpdated', {}, $locale) },
    ]),
    ...taxonomyFilters,
  ]);

  const visible = $derived(
    projects.filter((project) => {
      const q = search.trim().toLowerCase();
      const matchesQuery = !q || project.name.toLowerCase().includes(q) || project.repository.toLowerCase().includes(q) || project.website.toLowerCase().includes(q) || project.tags.some((tag) => tag.toLowerCase().includes(q)) || (project.ecosystems ?? []).some((value) => value.toLowerCase().includes(q)) || (project.languages ?? []).some((value) => value.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (activeFilter === 'goals') return project.hasActiveGoal ?? (project.slug === 'grove' || project.slug === 'vitest-run');
      if (activeFilter === 'recurring') return project.acceptsRecurringSupport ?? project.stats.monthlyRecurringMinor > 0;
      if (activeFilter === 'updated') {
        if (!project.updatedAt) return project.verified;
        const updatedAt = Date.parse(project.updatedAt);
        return Number.isFinite(updatedAt) && updatedAt >= Date.now() - 30 * 24 * 60 * 60 * 1000;
      }
      if (activeFilter?.startsWith('ecosystem:')) return (project.ecosystems ?? []).includes(activeFilter.slice('ecosystem:'.length));
      if (activeFilter?.startsWith('language:')) return (project.languages ?? []).includes(activeFilter.slice('language:'.length));
      if (activeFilter?.startsWith('tag:')) return project.tags.includes(activeFilter.slice('tag:'.length));
      return true;
    }),
  );

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.explore.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{t('public.explore.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{t('public.explore.lead', {}, $locale)}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.twoColumn).class}>
          <TextField label={t('public.explore.search', {}, $locale)} name="explore-search" bind:value={search} placeholder={t('public.explore.placeholder', {}, $locale)} type="search" />
          <div>
            <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}>{t('public.explore.filter', {}, $locale)}</p>
            <div class={stylex.attrs(publicStyles.row).class} role="group" aria-label={t('public.explore.filter', {}, $locale)}>
              {#each displayFilters as filter (filter.id)}
                <button
                  type="button"
                  class={stylex.attrs(publicStyles.chip, activeFilter === filter.id ? publicStyles.chipActive : null).class}
                  aria-pressed={activeFilter === filter.id}
                  onclick={() => (activeFilter = activeFilter === filter.id ? null : filter.id)}
                >
                  {filter.label}
                </button>
              {/each}
            </div>
          </div>
        </div>
        {#if viewState === 'error'}
          <StatusBanner variant="danger" title={t('public.explore.errorTitle', {}, $locale)} message={t('public.explore.errorMessage', {}, $locale)} />
        {:else if viewState === 'empty' || visible.length === 0}
          <EmptyState headingLevel={2} title={t('public.explore.emptyTitle', {}, $locale)} description={t('public.explore.emptyDescription', {}, $locale)} />
        {:else}
          <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}>{t('public.explore.projectCount', { count: visible.length }, $locale)}</p>
          <div class={stylex.attrs(publicStyles.homeProjects).class}>
            {#each visible as project (project.slug)}
              <article class={stylex.attrs(publicStyles.surface).class}>
                <div class={stylex.attrs(publicStyles.row).class}>
                  <ProjectLogo {project} size="small" />
                  <div>
                    <div class={stylex.attrs(publicStyles.row).class}>
                      <h2 class={stylex.attrs(publicStyles.sectionTitle).class}><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/{project.slug}">{project.name}</a></h2>
                      {#if project.verified}<Badge variant="forest" label={t('public.explore.verified', {}, $locale)} />{/if}
                    </div>
                  </div>
                </div>
                <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{project.description}</p>
                <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{project.repository}</p>
                <p class={stylex.attrs(publicStyles.mono).class}>{t('public.explore.projectStats', { count: project.stats.supporters, amount: formatCurrency(project.stats.monthlyRecurringMinor, project.currency, $locale) }, $locale)}</p>
                <div class={stylex.attrs(publicStyles.row).class}>
                  {#each project.tags as tag (tag)}<Badge label={tag} />{/each}
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
