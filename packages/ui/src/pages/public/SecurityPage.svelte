<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface SecurityGroup {
    heading: string;
    items: string[];
  }

  export interface Props {
    lead?: string;
    groups?: SecurityGroup[];
    report?: string;
  }

  let {
    lead,
    groups,
    report,
  }: Props = $props();

  const displayLead = $derived(lead ?? t('public.security.lead', {}, $locale));
  const displayGroups = $derived(groups ?? [
      {
        heading: t('public.security.payments', {}, $locale),
        items: [
          t('public.security.stripeStores', {}, $locale),
          t('public.security.merchant', {}, $locale),
          t('public.security.webhooks', {}, $locale),
          t('public.security.redirect', {}, $locale),
        ],
      },
      {
        heading: t('public.security.signIn', {}, $locale),
        items: [t('public.security.noPasswords', {}, $locale), t('public.security.sessions', {}, $locale), t('public.security.links', {}, $locale)],
      },
      {
        heading: t('public.security.operations', {}, $locale),
        items: [t('public.security.audit', {}, $locale), t('public.security.keys', {}, $locale), t('public.security.review', {}, $locale)],
      },
    ]);
  const displayReport = $derived(report ?? t('public.security.report', {}, $locale));

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.security.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{t('public.security.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{displayLead}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.prose).class}>
          {#each displayGroups as group (group.heading)}
            <h2>{group.heading}</h2>
            <ul>
              {#each group.items as item (item)}
                <li>{item}</li>
              {/each}
            </ul>
          {/each}
          <h2>{t('public.security.reportTitle', {}, $locale)}</h2>
          <p>{displayReport}</p>
        </div>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
