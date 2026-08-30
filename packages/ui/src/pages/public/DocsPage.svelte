<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface DocsNavItem {
    href: string;
    label: string;
  }

  interface DocsSection {
    id: string;
    heading: string;
    body: string;
  }

  interface Endpoint {
    method: string;
    path: string;
    note: string;
  }

  export interface Props {
    nav?: DocsNavItem[];
    sections?: DocsSection[];
    endpoints?: Endpoint[];
    events?: string;
  }

  let {
    nav,
    sections,
    endpoints,
    events,
  }: Props = $props();

  const displayNav = $derived(nav ?? [
    { href: '#getting-started', label: t('public.docs.gettingStarted', {}, $locale) },
    { href: '#projects', label: t('public.docs.projects', {}, $locale) },
    { href: '#supporters', label: t('public.docs.supporters', {}, $locale) },
    { href: '#api', label: t('public.docs.api', {}, $locale) },
  ]);
  const displaySections = $derived(sections ?? [
    { id: 'getting-started', heading: t('public.docs.gettingStarted', {}, $locale), body: t('public.docs.gettingStartedBody', {}, $locale) },
    { id: 'projects', heading: t('public.docs.projects', {}, $locale), body: t('public.docs.projectsBody', {}, $locale) },
    { id: 'supporters', heading: t('public.docs.supporters', {}, $locale), body: t('public.docs.supportersBody', {}, $locale) },
    { id: 'api', heading: t('public.docs.api', {}, $locale), body: t('public.docs.apiBody', {}, $locale) },
  ]);
  const displayEndpoints = $derived(endpoints ?? [
    { method: 'POST', path: '/v1/checkout/sessions', note: t('public.docs.startCheckout', {}, $locale) },
    { method: 'GET', path: '/v1/projects/:slug', note: t('public.docs.publicProject', {}, $locale) },
    { method: 'POST', path: '/v1/webhooks/stripe', note: t('public.docs.stripeEvents', {}, $locale) },
  ]);
  const displayEvents = $derived(events ?? t('public.docs.events', {}, $locale));

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.docs.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.pageTitle, publicStyles.docsTitle).class}>{t('public.docs.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{t('public.docs.lead', {}, $locale)}</p>
        <nav class={stylex.attrs(publicStyles.docsNavWrap).class} aria-label={t('public.docs.sections', {}, $locale)}>
          <ul class={stylex.attrs(publicStyles.docsNav).class}>
            {#each displayNav as item (item.href)}
              <li><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href={item.href}>{item.label}</a></li>
            {/each}
          </ul>
        </nav>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.prose, publicStyles.docsProse).class}>
          {#each displaySections as section (section.id)}
            <h2 id={section.id}>{section.heading}</h2>
            <p>{section.body}</p>
          {/each}
        </div>
        <ul class={stylex.attrs(publicStyles.apiList).class}>
          {#each displayEndpoints as endpoint (endpoint.path)}
            <li class={stylex.attrs(publicStyles.mono, publicStyles.surface, publicStyles.docsApiItem).class}>
              <strong>{endpoint.method}</strong> {endpoint.path}
              <span class={stylex.attrs(publicStyles.muted).class}> · {endpoint.note}</span>
            </li>
          {/each}
        </ul>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted, publicStyles.small).class}>{displayEvents}</p>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
