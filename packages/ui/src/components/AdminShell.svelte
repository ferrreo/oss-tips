<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';
  import { locale, t } from '../lib/i18n.js';
  import { attrs, shells } from '../styles/shells.stylex.js';

  export interface Props {
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
    projectContext?: string;
    children?: Snippet;
    initialMenuOpen?: boolean;
    menuId?: string;
    mainId?: string;
  }

  let {
    navGroups,
    title,
    lede,
    projectContext,
    children,
    initialMenuOpen = false,
    menuId = 'admin-nav-sheet',
    mainId = 'main-content',
  }: Props = $props();

  let menuOpen = $state(false);
  let sheetClosing = $state(false);
  let sheetEntering = $state(false);
  let hasInitialised = false;
  let menuSheet = $state<HTMLDialogElement | undefined>(undefined);
  let menuTrigger = $state<HTMLButtonElement | undefined>(undefined);

  $effect(() => {
    if (hasInitialised) return;
    menuOpen = initialMenuOpen;
    hasInitialised = true;
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

  const rootAttrs = attrs(shells.admin);
  const skipAttrs = attrs(shells.skipLink, shells.focus);
  const sidebarAttrs = attrs(shells.sidebar);
  const brandAttrs = attrs(shells.brand);
  const accentAttrs = attrs(shells.adminAccent);
  const subAttrs = attrs(shells.adminSub);
  const mainAttrs = attrs(shells.main);
  const mobileBarAttrs = attrs(shells.mobileBar);
  const mobileTriggerAttrs = attrs(shells.mobileTrigger, shells.focus);
  const iconAttrs = attrs(shells.icon);
  const headerAttrs = attrs(shells.header);
  const contextAttrs = attrs(shells.context);
  const titleAttrs = attrs(shells.title);
  const ledeAttrs = attrs(shells.lede);
  const sheetAttrs = attrs(shells.sheet);
  const panelAttrs = $derived(
    attrs(
      shells.sheetPanel,
      sheetClosing ? shells.sheetPanelExit : sheetEntering ? shells.sheetPanelEnter : null,
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
    sheetEntering = false;
    if (sheetClosing) return;
    if (!menuSheet?.open) {
      menuOpen = false;
      sheetClosing = false;
      return;
    }
    menuOpen = false;
    sheetClosing = true;
    setTimeout(finishSheetClose, 220);
  }

  function finishSheetClose() {
    if (!sheetClosing) return;
    menuSheet?.close();
    sheetClosing = false;
  }

  function handleSheetClose() {
    sheetClosing = false;
    sheetEntering = false;
    menuOpen = false;
    menuTrigger?.focus();
  }

  function handleSheetAnimationEnd(event: AnimationEvent) {
    if (event.target !== event.currentTarget || !sheetClosing) return;
    finishSheetClose();
  }

  function handleSheetCancel(event: Event) {
    event.preventDefault();
    closeMenu();
  }

  function handleSheetKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeMenu();
  }

  function handleSheetClick(event: MouseEvent) {
    if (event.target === menuSheet) closeMenu();
  }
</script>

<div class={rootAttrs.class} style={rootAttrs.style}>
  <aside class={sidebarAttrs.class} style={sidebarAttrs.style} aria-label={t('common.adminNavigation', {}, $locale)}>
    <a class={skipAttrs.class} style={skipAttrs.style} href={`#${mainId}`}>{t('nav.skipToContent', {}, $locale)}</a>
    <div class={brandAttrs.class} style={brandAttrs.style}>
      <p class={accentAttrs.class} style={accentAttrs.style}>{t('common.adminBrand', {}, $locale)}</p>
      <p class={subAttrs.class} style={subAttrs.style}>{t('common.operations', {}, $locale)}</p>
    </div>
    <SidebarNav groups={navGroups} ariaLabel={t('common.adminNavigation', {}, $locale)} tone="admin" />
  </aside>

  <main class={mainAttrs.class} style={mainAttrs.style} id={mainId}>
    <div class={mobileBarAttrs.class} style={mobileBarAttrs.style}>
      <button
        class={mobileTriggerAttrs.class}
        style={mobileTriggerAttrs.style}
        bind:this={menuTrigger}
        type="button"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? t('nav.closeAdmin', {}, $locale) : t('nav.openAdmin', {}, $locale)}
        onclick={menuOpen ? closeMenu : openMenu}
      >
        <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
          {#if menuOpen}
            <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          {:else}
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          {/if}
        </svg>
        <span>{menuOpen ? t('common.close', {}, $locale) : t('common.menu', {}, $locale)}</span>
      </button>
    </div>
    {#if title}
      <header class={headerAttrs.class} style={headerAttrs.style}>
        <p class={contextAttrs.class} style={contextAttrs.style}>
          {projectContext ?? t('common.noProjectSelected', {}, $locale)}
        </p>
        <h1 class={titleAttrs.class} style={titleAttrs.style}>{title}</h1>
        {#if lede}
          <p class={ledeAttrs.class} style={ledeAttrs.style}>{lede}</p>
        {/if}
      </header>
    {/if}
    {@render children?.()}
  </main>
</div>

<dialog
  bind:this={menuSheet}
  data-pl-sheet
  id={menuId}
  class={sheetAttrs.class}
  style={sheetAttrs.style}
  hidden={!menuOpen && !sheetClosing}
  aria-label={t('common.adminNavigation', {}, $locale)}
  oncancel={handleSheetCancel}
  onkeydown={handleSheetKeydown}
  onclose={handleSheetClose}
  onclick={handleSheetClick}
>
  <div
    class={panelAttrs.class}
    style={panelAttrs.style}
    onanimationend={handleSheetAnimationEnd}
  >
    <div class={topAttrs.class} style={topAttrs.style}>
      <h2 class={sheetTitleAttrs.class} style={sheetTitleAttrs.style}>{t('common.adminBrand', {}, $locale)}</h2>
      <button class={closeAttrs.class} style={closeAttrs.style} type="button" aria-label={t('nav.closeAdmin', {}, $locale)} onclick={closeMenu}>
        <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        </svg>
      </button>
    </div>
    <SidebarNav groups={navGroups} ariaLabel={t('common.adminNavigation', {}, $locale)} tone="admin" onNavigate={closeMenu} />
  </div>
</dialog>
