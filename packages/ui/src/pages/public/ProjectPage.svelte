<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import GoalProgress from '../../components/GoalProgress.svelte';
  import TierCard from '../../components/TierCard.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Badge from '../../components/Badge.svelte';
  import type { SupportCheckoutRequest } from '../../components/SupportComposer.svelte';
  import type { Goal, Post, Project, Supporter, Tier } from '../../fixtures/demo.js';
  import { formatCurrency, formatDate, formatNumber, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface CommunityLink {
    label: string;
    href: string;
  }

  interface ProjectStat {
    label: string;
    value: string;
    compare: string;
    sparkline: number[];
  }

  export interface Props {
    project: Project;
    tiers: Tier[];
    goal?: Goal | null;
    supporters: Supporter[];
    posts: Post[];
    community?: CommunityLink[];
    stats?: ProjectStat[];
    embed?: string;
    initialTier?: string;
    checkoutDisabled?: boolean;
    checkoutLoading?: boolean;
    checkoutError?: string;
    oncontinue?: ((request: SupportCheckoutRequest) => void | Promise<void>) | undefined;
  }

  let {
    project,
    tiers,
    goal = null,
    supporters,
    posts,
    community = [],
    stats,
    embed = `<script async src="https://oss.tips/widgets/${project.slug}/thanks.js"><\/script>`,
    initialTier = 'supporter',
    checkoutDisabled = false,
    checkoutLoading = false,
    checkoutError = '',
    oncontinue,
  }: Props = $props();

  let selectedTier = $state(untrack(() => initialTier));
  const visibleThanks = $derived(supporters.filter((supporter) => supporter.public && supporter.message));
  const displayStats = $derived(stats ?? [
    { label: t('public.project.activeSupporters', {}, $locale), value: formatNumber(project.stats.supporters, $locale), compare: t('public.project.publicCount', {}, $locale), sparkline: [210, 228, 241, 255, 268, 284] },
    { label: t('public.project.monthlyRecurring', {}, $locale), value: formatCurrency(project.stats.monthlyRecurringMinor, project.currency, $locale), compare: t('public.project.settledBeforeFees', {}, $locale), sparkline: [4100, 4550, 5020, 5480, 6010, 6421] },
    { label: t('public.project.oneOffThisMonth', {}, $locale), value: formatCurrency(project.stats.oneOffThisMonthMinor, project.currency, $locale), compare: t('public.project.settledThisMonth', {}, $locale), sparkline: [1800, 2400, 3100, 4200, 5100, 6420] },
  ]);

  const contentClass = stylex.attrs(publicStyles.container, publicStyles.projectContent).class;
  const sectionTitleClass = stylex.attrs(publicStyles.sectionTitle).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <HeroLandscape
      {...(project.bannerAssetId ? { bannerAssetId: project.bannerAssetId } : {})}
      {...(project.bannerUrl ? { imageUrl: project.bannerUrl } : {})}
    />
    <div class={contentClass}>
      <div class={stylex.attrs(publicStyles.projectIdentity).class}>
        <ProjectHero {project} />
        <div class={stylex.attrs(publicStyles.row).class}>
          {#each community as link (link.href)}
            <a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href={link.href}>{link.label}</a>
          {/each}
        </div>
        <div class={`${stylex.attrs(publicStyles.row).class} ${stylex.attrs(publicStyles.projectActions).class}`}>
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href="#support">{t('public.project.support', { project: project.name }, $locale)}</a>
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href="#updates">{t('public.project.readUpdates', {}, $locale)}</a>
        </div>
      </div>

      <div id="support" class={stylex.attrs(publicStyles.projectCompose, publicStyles.projectSection).class}>
        <SupportComposer
          tiers={tiers}
          currency={project.currency}
          {...(project.minSupportMinor === undefined
            ? {}
            : { minAmountMinor: project.minSupportMinor })}
          {...(project.maxSupportMinor === undefined
            ? {}
            : { maxAmountMinor: project.maxSupportMinor })}
          disabled={checkoutDisabled}
          loading={checkoutLoading}
          error={checkoutError}
          bind:selectedTierId={selectedTier}
          {oncontinue}
        />
        {#if project.showGoal !== false}
          {#if goal}
            <GoalProgress {goal} />
          {:else}
            <p class={stylex.attrs(publicStyles.muted).class}>{t('public.project.noActiveGoal', {}, $locale)}</p>
          {/if}
        {/if}
      </div>

      <section class={stylex.attrs(publicStyles.projectSection).class} aria-labelledby="membership-heading">
        <h2 id="membership-heading" class={sectionTitleClass}>{t('public.project.membershipTiers', {}, $locale)}</h2>
        {#if tiers.length > 0}
          <div class={stylex.attrs(publicStyles.projectTiers).class}>
            {#each tiers as tier (tier.id)}
              <TierCard {tier} currency={project.currency} selected={selectedTier === tier.id} onclick={() => (selectedTier = tier.id)} />
            {/each}
          </div>
        {:else}
          <p class={stylex.attrs(publicStyles.muted).class}>{t('public.project.noMembershipTiers', {}, $locale)}</p>
        {/if}
      </section>

      <div id="updates" class={stylex.attrs(publicStyles.projectFeed).class}>
        <section aria-labelledby="updates-heading">
          <h2 id="updates-heading" class={sectionTitleClass}>{t('public.project.recentUpdates', {}, $locale)}</h2>
          {#if posts.length > 0}
            {#each posts as post (post.id)}
              <article class={stylex.attrs(publicStyles.update).class}>
                <div class={stylex.attrs(publicStyles.row).class}>
                  <h3><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/{project.slug}/posts/{post.slug}">{post.title}</a></h3>
                  <Badge label={post.tierVisibility} />
                </div>
                <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{post.excerpt}</p>
                  <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{t('public.post.publishedBy', { date: formatDate(post.publishedAt, $locale), author: post.author }, $locale)}</p>
              </article>
            {/each}
          {:else}
            <p class={stylex.attrs(publicStyles.muted).class}>{t('public.project.noPublicUpdates', {}, $locale)}</p>
          {/if}
        </section>
        {#if project.showSupporters !== false}
          <SupporterWall supporters={supporters} currency={project.currency} />
        {/if}
        {#if project.showStats !== false}
          <section aria-labelledby="stats-heading">
            <h2 id="stats-heading" class={sectionTitleClass}>{t('public.project.stats', {}, $locale)}</h2>
            <div class={stylex.attrs(publicStyles.stack).class}>
              {#each displayStats as stat (stat.label)}
                <DataCard label={stat.label} value={stat.value} compare={stat.compare} sparkline={stat.sparkline} />
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <section class={stylex.attrs(publicStyles.thanks, publicStyles.projectSection).class} aria-labelledby="thanks-heading">
        <div class={stylex.attrs(publicStyles.row).class}>
          <div>
            <h2 id="thanks-heading" class={sectionTitleClass}>{t('public.project.thanks', {}, $locale)}</h2>
            <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{t('public.project.thanksDescription', {}, $locale)}</p>
          </div>
          <Badge variant="forest" label={t('public.project.embeddableWidget', {}, $locale)} />
        </div>
        {#if visibleThanks.length > 0}
          <div class={stylex.attrs(publicStyles.thanksGrid).class}>
            {#each visibleThanks as note (note.id)}
              <article class={stylex.attrs(publicStyles.thanksNote).class}>
                <p>“{note.message}”</p>
                <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{note.displayName} · {note.tierName} · {note.relativeTime}</p>
              </article>
            {/each}
          </div>
        {:else}
          <p class={stylex.attrs(publicStyles.muted).class}>{t('public.project.noPublicNotes', {}, $locale)}</p>
        {/if}
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted, publicStyles.breakAnywhere).class}>{embed}</p>
      </section>

      <p class={stylex.attrs(publicStyles.legalNote).class}>
        {t('public.project.securePayments', {}, $locale)} {t('public.project.merchantOfRecord', { project: project.name }, $locale)}
        <a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/pricing">{t('public.project.howFees', {}, $locale)}</a> ·
        <a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/security">{t('public.project.report', {}, $locale)}</a>
      </p>
    </div>
  {/snippet}
</PublicPageFrame>
