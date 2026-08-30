<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import BrandWordmark from '../../components/BrandWordmark.svelte';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import Badge from '../../components/Badge.svelte';
  import ProjectLogo from '../../components/ProjectLogo.svelte';
  import { featuredProjects, type Project } from '../../fixtures/demo.js';
  import { formatCurrency, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface Cadence {
    name: string;
    body: string;
  }

  export interface Props {
    strapline?: string;
    support?: string;
    cadences?: Cadence[];
    projects?: Project[];
  }

  let {
    strapline,
    support,
    cadences,
    projects = featuredProjects,
  }: Props = $props();

  const displayStrapline = $derived(strapline ?? t('home.strapline', {}, $locale));
  const displaySupport = $derived(support ?? t('home.support', {}, $locale));
  const displayCadences = $derived(
    cadences ?? [
      { name: t('home.oneOff', {}, $locale), body: t('home.oneOffBody', { amount: formatCurrency(200, 'GBP', $locale) }, $locale) },
      { name: t('home.monthly', {}, $locale), body: t('home.monthlyBody', {}, $locale) },
      { name: t('home.annual', {}, $locale), body: t('home.annualBody', {}, $locale) },
    ],
  );

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container).class;
  const sectionClass = stylex.attrs(publicStyles.section).class;
  const cardClass = stylex.attrs(publicStyles.surface).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={`${containerClass} ${stylex.attrs(publicStyles.heroSplit).class}`}>
        <div class={stylex.attrs(publicStyles.heroCopy).class}>
          <BrandWordmark size="large" />
          <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{displayStrapline}</h1>
          <p class={stylex.attrs(publicStyles.lead).class}>{displaySupport}</p>
          <div class={stylex.attrs(publicStyles.row).class}>
            <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href="/explore">{t('home.exploreProjects', {}, $locale)}</a>
            <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href="/about">{t('home.howItWorks', {}, $locale)}</a>
          </div>
        </div>
        <HeroLandscape />
      </div>
    </section>

    <section class={sectionClass}>
      <div class={containerClass}>
        <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{t('home.indexTitle', {}, $locale)}</h2>
        <p class={stylex.attrs(publicStyles.lead, publicStyles.small).class}>{t('home.noVolumeRank', {}, $locale)}</p>
        {#if projects.length > 0}
          <div class={stylex.attrs(publicStyles.homeProjects).class}>
            {#each projects as project (project.slug)}
              <article class={cardClass}>
                <div class={stylex.attrs(publicStyles.row).class}>
                  <ProjectLogo {project} size="small" />
                  <div class={stylex.attrs(publicStyles.row).class}>
                    <a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/{project.slug}"><strong>{project.name}</strong></a>
                    {#if project.verified}<Badge variant="forest" label={t('home.verified', {}, $locale)} />{/if}
                  </div>
                </div>
                <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{project.description}</p>
                <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{project.repository}</p>
                <p class={stylex.attrs(publicStyles.mono).class}>{t('home.projectStats', { count: project.stats.supporters, amount: formatCurrency(project.stats.monthlyRecurringMinor, project.currency, $locale) }, $locale)}</p>
                <div class={stylex.attrs(publicStyles.row).class}>
                  {#each project.tags as tag (tag)}<Badge label={tag} />{/each}
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class={stylex.attrs(publicStyles.muted).class}>{t('home.noProjects', {}, $locale)}</p>
        {/if}

        <section class={stylex.attrs(publicStyles.panel).class}>
          <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{t('home.howSupportWorks', {}, $locale)}</h2>
          <div class={stylex.attrs(publicStyles.cadenceGrid).class}>
            {#each displayCadences as cadence (cadence.name)}
              <div>
                <strong>{cadence.name}</strong>
                <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{cadence.body}</p>
              </div>
            {/each}
          </div>
        </section>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
