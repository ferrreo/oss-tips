<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';
  import BrandWordmark from './BrandWordmark.svelte';
  import LocaleSelect from './LocaleSelect.svelte';
  import { locale, t } from '../lib/i18n.js';
  import { attrs, shells } from '../styles/shells.stylex.js';

  export interface Props {
    theme?: 'light' | 'dark';
    activeHref?: string;
    initialMenuOpen?: boolean;
    menuId?: string;
  }

  let { theme, activeHref, initialMenuOpen = false, menuId = 'public-nav-sheet' }: Props = $props();

  let observed = $state<'light' | 'dark'>('light');
  let menuOpen = $state(false);
  let sheetClosing = $state(false);
  let sheetEntering = $state(false);
  let hasInitialised = false;
  let menuSheet = $state<HTMLDialogElement | undefined>(undefined);
  let menuTrigger = $state<HTMLButtonElement | undefined>(undefined);
  const resolved = $derived(theme ?? observed);

  $effect(() => {
    if (hasInitialised) return;
    menuOpen = initialMenuOpen;
    hasInitialised = true;
  });

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

  $effect(() => {
    const sheet = menuSheet;
    if (!sheet) return;
    if (menuOpen && !sheet.open) {
      sheet.showModal();
      sheetEntering = true;
    }
    if (!menuOpen && !sheetClosing && sheet.open) sheet.close();
  });

  const navAttrs = attrs(shells.publicNav);
  const skipAttrs = attrs(shells.skipLink, shells.focus);
  const homeAttrs = attrs(shells.publicHome, shells.focus);
  const desktopNavAttrs = attrs(shells.publicDesktopNav);
  const linksAttrs = attrs(shells.publicLinks);
  const linkAttrs = attrs(shells.publicLink, shells.focus);
  const activeLinkAttrs = attrs(shells.publicLink, shells.publicLinkActive, shells.focus);
  const actionsAttrs = attrs(shells.publicActions, shells.publicDesktopActions);
  const sheetActionsAttrs = attrs(shells.sheetActions);
  const signInAttrs = attrs(shells.secondaryLink, shells.focus);
  const menuButtonAttrs = attrs(shells.mobileMenuButton, shells.focus);
  const iconAttrs = attrs(shells.icon);
  const sheetAttrs = attrs(shells.sheet);
  const panelAttrs = $derived(
    attrs(
      shells.sheetPanel,
      sheetEntering ? shells.sheetPanelEnter : sheetClosing ? shells.sheetPanelExit : null,
    ),
  );
  const topAttrs = attrs(shells.sheetTop);
  const sheetTitleAttrs = attrs(shells.sheetTitle);
  const closeAttrs = attrs(shells.closeButton, shells.focus);

  function openMenu() {
    sheetClosing = false;
    sheetEntering = false;
    menuOpen = true;
  }

  function closeMenu() {
    if (sheetClosing) return;
    if (!menuSheet?.open) {
      menuOpen = false;
      return;
    }
    menuOpen = false;
    sheetClosing = true;
  }

  function handleSheetClose() {
    sheetClosing = false;
    sheetEntering = false;
    menuOpen = false;
    menuTrigger?.focus();
  }

  function handleSheetAnimationEnd(event: AnimationEvent) {
    if (event.target !== event.currentTarget || !sheetClosing) return;
    menuSheet?.close();
    sheetClosing = false;
  }

  function handleSheetCancel(event: Event) {
    event.preventDefault();
    closeMenu();
  }

  function handleSheetClick(event: MouseEvent) {
    if (event.target === menuSheet) closeMenu();
  }

  function linkClass(href: string) {
    const active = activeHref === href;
    const link = active ? activeLinkAttrs : linkAttrs;
    return { class: link.class, style: link.style, active };
  }

  const exploreLink = $derived(linkClass('/explore'));
  const aboutLink = $derived(linkClass('/about'));
  const docsLink = $derived(linkClass('/docs'));
  const pricingLink = $derived(linkClass('/pricing'));
</script>

<header class={navAttrs.class} style={navAttrs.style}>
  <a class={skipAttrs.class} style={skipAttrs.style} href="#main-content">{t('nav.skipToContent', {}, $locale)}</a>
  <a
    class={homeAttrs.class}
    style={homeAttrs.style}
    href="/"
    aria-label={t('nav.home', {}, $locale)}
  >
    <BrandWordmark theme={resolved} size="compact" decorative />
  </a>

  <nav
    class={desktopNavAttrs.class}
    style={desktopNavAttrs.style}
    aria-label={t('nav.public', {}, $locale)}
  >
    <ul class={linksAttrs.class} style={linksAttrs.style}>
      <li>
        <a class={exploreLink.class} style={exploreLink.style} href="/explore" aria-current={exploreLink.active ? 'page' : undefined}>{t('nav.explore', {}, $locale)}</a>
      </li>
      <li>
        <a class={aboutLink.class} style={aboutLink.style} href="/about" aria-current={aboutLink.active ? 'page' : undefined}>{t('nav.about', {}, $locale)}</a>
      </li>
      <li>
        <a class={docsLink.class} style={docsLink.style} href="/docs" aria-current={docsLink.active ? 'page' : undefined}>{t('nav.docs', {}, $locale)}</a>
      </li>
      <li>
        <a class={pricingLink.class} style={pricingLink.style} href="/pricing" aria-current={pricingLink.active ? 'page' : undefined}>{t('nav.fees', {}, $locale)}</a>
      </li>
    </ul>
  </nav>

  <div class={actionsAttrs.class} style={actionsAttrs.style}>
    <LocaleSelect />
    <ThemeToggle />
    <a class={signInAttrs.class} style={signInAttrs.style} href="/sign-in">{t('nav.signIn', {}, $locale)}</a>
  </div>

  <button
    class={menuButtonAttrs.class}
    style={menuButtonAttrs.style}
    bind:this={menuTrigger}
    type="button"
    aria-expanded={menuOpen}
    aria-controls={menuId}
    aria-label={menuOpen ? t('nav.close', {}, $locale) : t('nav.open', {}, $locale)}
    onclick={menuOpen ? closeMenu : openMenu}
  >
    <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
      {#if menuOpen}
        <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
      {:else}
        <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
      {/if}
    </svg>
    {#if !menuOpen}
      <span>{t('nav.menu', {}, $locale)}</span>
    {/if}
  </button>
</header>

<dialog
  bind:this={menuSheet}
  data-pl-sheet
  id={menuId}
  class={sheetAttrs.class}
  style={sheetAttrs.style}
  hidden={!menuOpen && !sheetClosing}
  aria-label={t('nav.publicMenu', {}, $locale)}
  oncancel={handleSheetCancel}
  onclose={handleSheetClose}
  onclick={handleSheetClick}
>
  <div
    class={panelAttrs.class}
    style={panelAttrs.style}
    onanimationend={handleSheetAnimationEnd}
  >
    <div class={topAttrs.class} style={topAttrs.style}>
      <h2 class={sheetTitleAttrs.class} style={sheetTitleAttrs.style}>oss.tips</h2>
      <button
        class={closeAttrs.class}
        style={closeAttrs.style}
        type="button"
        aria-label={t('nav.close', {}, $locale)}
        onclick={closeMenu}
      >
        <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        </svg>
      </button>
    </div>
    <nav aria-label={t('nav.publicMenu', {}, $locale)}>
      <ul class={linksAttrs.class} style={linksAttrs.style}>
        <li><a class={exploreLink.class} style={exploreLink.style} href="/explore" aria-current={exploreLink.active ? 'page' : undefined} onclick={closeMenu}>{t('nav.explore', {}, $locale)}</a></li>
        <li><a class={aboutLink.class} style={aboutLink.style} href="/about" aria-current={aboutLink.active ? 'page' : undefined} onclick={closeMenu}>{t('nav.about', {}, $locale)}</a></li>
        <li><a class={docsLink.class} style={docsLink.style} href="/docs" aria-current={docsLink.active ? 'page' : undefined} onclick={closeMenu}>{t('nav.docs', {}, $locale)}</a></li>
        <li><a class={pricingLink.class} style={pricingLink.style} href="/pricing" aria-current={pricingLink.active ? 'page' : undefined} onclick={closeMenu}>{t('nav.fees', {}, $locale)}</a></li>
      </ul>
    </nav>
    <div class={sheetActionsAttrs.class} style={sheetActionsAttrs.style}>
      <LocaleSelect />
      <ThemeToggle />
      <a class={signInAttrs.class} style={signInAttrs.style} href="/sign-in" onclick={closeMenu}>{t('nav.signIn', {}, $locale)}</a>
    </div>
  </div>
</dialog>
