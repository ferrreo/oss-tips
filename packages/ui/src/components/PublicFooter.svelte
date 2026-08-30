<script lang="ts">
  import HeroLandscape from './HeroLandscape.svelte';
  import BrandWordmark from './BrandWordmark.svelte';
  import { attrs, shells } from '../styles/shells.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';
  import { locale, t } from '../lib/i18n.js';

  export interface Props {
    theme?: 'light' | 'dark';
  }

  let { theme }: Props = $props();

  let observed = $state<'light' | 'dark'>('light');
  const resolved = $derived(theme ?? observed);

  $effect(() => {
    if (theme) return;
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => {
      observed = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  const footerAttrs = attrs(shells.footer);
  const containerAttrs = attrs(primitives.container);
  const landscapeAttrs = attrs(shells.footerLandscape);
  const mastheadAttrs = attrs(shells.footerMasthead);
  const copyAttrs = attrs(shells.footerCopy);
  const straplineAttrs = attrs(shells.footerStrapline);
  const leadAttrs = attrs(shells.footerLead);
  const navAttrs = attrs(shells.footerNav);
  const groupAttrs = attrs(shells.footerGroup);
  const headingAttrs = attrs(shells.footerHeading);
  const linksAttrs = attrs(shells.footerLinks);
  const linkAttrs = attrs(shells.footerLink, shells.focus);
  const legalAttrs = attrs(shells.footerLegal);
  const legalLinkAttrs = attrs(shells.footerLegalLink, shells.focus);
</script>

<footer class={footerAttrs.class} style={footerAttrs.style}>
  <div class={landscapeAttrs.class} style={landscapeAttrs.style}>
    <HeroLandscape theme={resolved} compact />
  </div>
  <div class={containerAttrs.class} style={containerAttrs.style}>
    <div class={mastheadAttrs.class} style={mastheadAttrs.style}>
      <div class={copyAttrs.class} style={copyAttrs.style}>
        <BrandWordmark theme={resolved} size="large" />
        <p class={straplineAttrs.class} style={straplineAttrs.style}>{t('footer.strapline', {}, $locale)}</p>
        <p class={leadAttrs.class} style={leadAttrs.style}>
          {t('footer.lead', {}, $locale)}
        </p>
      </div>
      <nav class={navAttrs.class} style={navAttrs.style} aria-label={t('footer.navigation', {}, $locale)}>
        <div class={groupAttrs.class} style={groupAttrs.style}>
          <strong class={headingAttrs.class} style={headingAttrs.style}>{t('footer.platform', {}, $locale)}</strong>
          <ul class={linksAttrs.class} style={linksAttrs.style}>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/about">{t('footer.about', {}, $locale)}</a></li>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/security">{t('footer.security', {}, $locale)}</a></li>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/transparency">{t('footer.transparency', {}, $locale)}</a></li>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/terms">{t('footer.terms', {}, $locale)}</a></li>
          </ul>
        </div>
        <div class={groupAttrs.class} style={groupAttrs.style}>
          <strong class={headingAttrs.class} style={headingAttrs.style}>{t('footer.projects', {}, $locale)}</strong>
          <ul class={linksAttrs.class} style={linksAttrs.style}>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/explore">{t('nav.explore', {}, $locale)}</a></li>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/docs">{t('footer.documentation', {}, $locale)}</a></li>
            <li><a class={linkAttrs.class} style={linkAttrs.style} href="/pricing">{t('footer.fees', {}, $locale)}</a></li>
          </ul>
        </div>
      </nav>
    </div>
    <p class={legalAttrs.class} style={legalAttrs.style}>
      <span>{t('footer.paymentNote', {}, $locale)}</span>
      <a class={legalLinkAttrs.class} style={legalLinkAttrs.style} href="/terms/privacy">{t('footer.privacy', {}, $locale)}</a>
    </p>
  </div>
</footer>
