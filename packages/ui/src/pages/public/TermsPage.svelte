<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { formatDate, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface TermsSection {
    heading: string;
    body: string;
  }

  interface RelatedDocument {
    href: string;
    label: string;
  }

  export interface Props {
    updated?: string;
    sections?: TermsSection[];
    docs?: RelatedDocument[];
  }

  let {
    updated,
    sections,
    docs,
  }: Props = $props();

  const displayUpdated = $derived.by(() => {
    if (updated) {
      const parsed = new Date(updated);
      if (!Number.isNaN(parsed.getTime())) return t('public.terms.updated', { date: formatDate(parsed, $locale) }, $locale);
      return updated;
    }
    return t('public.terms.updated', { date: formatDate('2026-08-01', $locale) }, $locale);
  });
  const displaySections = $derived(sections ?? [
    { heading: t('public.terms.serviceHeading', {}, $locale), body: t('public.terms.serviceBody', {}, $locale) },
    { heading: t('public.terms.accountsHeading', {}, $locale), body: t('public.terms.accountsBody', {}, $locale) },
    { heading: t('public.terms.feesHeading', {}, $locale), body: t('public.terms.feesBody', {}, $locale) },
    { heading: t('public.terms.refundsHeading', {}, $locale), body: t('public.terms.refundsBody', {}, $locale) },
  ]);
  const displayDocs = $derived(docs ?? [
    { href: '/terms/privacy', label: t('public.terms.privacy', {}, $locale) },
    { href: '/terms/acceptable-use', label: t('public.terms.acceptableUse', {}, $locale) },
    { href: '/terms/refunds', label: t('public.terms.refunds', {}, $locale) },
    { href: '/terms/cookies', label: t('public.terms.cookies', {}, $locale) },
  ]);

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.terms.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{t('public.terms.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{displayUpdated}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.prose).class}>
          {#each displaySections as section (section.heading)}
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          {/each}
          <h2>{t('public.terms.related', {}, $locale)}</h2>
          <ul>
            {#each displayDocs as doc (doc.href)}
              <li><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href={doc.href}>{doc.label}</a></li>
            {/each}
          </ul>
        </div>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
