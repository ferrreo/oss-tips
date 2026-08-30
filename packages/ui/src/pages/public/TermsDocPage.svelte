<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export type LegalDocument = 'privacy' | 'acceptable-use' | 'refunds' | 'cookies';

  interface LegalSection {
    heading: string;
    body: string;
  }

  export interface LegalDocumentContent {
    title: string;
    sections: LegalSection[];
  }

  export interface Props {
    doc?: LegalDocument | string;
    documents?: Partial<Record<LegalDocument, LegalDocumentContent>>;
    updated?: string;
  }

  const documentMessageKeys: Record<LegalDocument, { title: MessageKey; sections: Array<{ heading: MessageKey; body: MessageKey }> }> = {
    privacy: {
      title: 'public.terms.privacy',
      sections: [
        { heading: 'public.terms.privacy.collectHeading', body: 'public.terms.privacy.collectBody' },
        { heading: 'public.terms.privacy.sellHeading', body: 'public.terms.privacy.sellBody' },
        { heading: 'public.terms.privacy.retentionHeading', body: 'public.terms.privacy.retentionBody' },
        { heading: 'public.terms.privacy.recognitionHeading', body: 'public.terms.privacy.recognitionBody' },
      ],
    },
    'acceptable-use': {
      title: 'public.terms.acceptableUse',
      sections: [
        { heading: 'public.terms.acceptable.projectsHeading', body: 'public.terms.acceptable.projectsBody' },
        { heading: 'public.terms.acceptable.supportersHeading', body: 'public.terms.acceptable.supportersBody' },
        { heading: 'public.terms.acceptable.postsHeading', body: 'public.terms.acceptable.postsBody' },
      ],
    },
    refunds: {
      title: 'public.terms.refunds',
      sections: [
        { heading: 'public.terms.refunds.projectHeading', body: 'public.terms.refunds.projectBody' },
        { heading: 'public.terms.refunds.platformHeading', body: 'public.terms.refunds.platformBody' },
        { heading: 'public.terms.refunds.graceHeading', body: 'public.terms.refunds.graceBody' },
      ],
    },
    cookies: {
      title: 'public.terms.cookies',
      sections: [
        { heading: 'public.terms.cookies.essentialHeading', body: 'public.terms.cookies.essentialBody' },
        { heading: 'public.terms.cookies.adsHeading', body: 'public.terms.cookies.adsBody' },
        { heading: 'public.terms.cookies.stripeHeading', body: 'public.terms.cookies.stripeBody' },
      ],
    },
  };

  let { doc = 'privacy', documents = {}, updated }: Props = $props();

  const content = $derived.by(() => {
    const custom = documents[doc as LegalDocument];
    if (custom) return custom;
    const keys = documentMessageKeys[doc as LegalDocument];
    if (!keys) {
      return {
        title: t('public.terms.unknownTitle', {}, $locale),
        sections: [{ heading: t('public.terms.unknownHeading', {}, $locale), body: t('public.terms.unknownBody', {}, $locale) }],
      };
    }
    return {
      title: t(keys.title, {}, $locale),
      sections: keys.sections.map(({ heading, body }) => ({ heading: t(heading, {}, $locale), body: t(body, {}, $locale) })),
    };
  });
  const displayUpdated = $derived.by(() => {
    if (updated) {
      const parsed = new Date(updated);
      if (!Number.isNaN(parsed.getTime())) return t('public.terms.updated', { date: formatDate(parsed, $locale) }, $locale);
      return updated;
    }
    return t('public.terms.updated', { date: formatDate('2026-08-01', $locale) }, $locale);
  });

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.terms.kicker', {}, $locale)}</p>
        <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/terms">{t('public.terms.title', {}, $locale)}</a> / {content.title}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle, publicStyles.heroTitleLong).class}>{content.title}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{displayUpdated}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.prose).class}>
          {#each content.sections as section (section.heading)}
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          {/each}
        </div>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
