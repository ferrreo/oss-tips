<script lang="ts">
  import SidebarNav from './SidebarNav.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import type { Snippet } from 'svelte';
  import { locale, t } from '../lib/i18n.js';
  import { attrs, shells } from '../styles/shells.stylex.js';

  export interface Props {
    projectName: string;
    navGroups: NavGroup[];
    title?: string;
    lede?: string;
    children?: Snippet;
    initialMenuOpen?: boolean;
    menuId?: string;
    mainId?: string;
  }

  let {
    projectName,
    navGroups,
    title,
    lede,
    children,
    initialMenuOpen = false,
    menuId = 'dashboard-nav-sheet',
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

  const rootAttrs = attrs(shells.dashboard);
  const skipAttrs = attrs(shells.skipLink, shells.focus);
  const sidebarAttrs = attrs(shells.sidebar);
  const brandAttrs = attrs(shells.brand);
  const overlineAttrs = attrs(shells.overline);
  const projectAttrs = attrs(shells.project);
  const mainAttrs = attrs(shells.main);
  const mobileBarAttrs = attrs(shells.mobileBar);
  const mobileTriggerAttrs = attrs(shells.mobileTrigger, shells.focus);
  const iconAttrs = attrs(shells.icon);
  const headerAttrs = attrs(shells.header);
  const titleAttrs = attrs(shells.title);
  const ledeAttrs = attrs(shells.lede);
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
</script>

<div class={rootAttrs.class} style={rootAttrs.style}>
  <aside class={sidebarAttrs.class} style={sidebarAttrs.style} aria-label={t('common.projectDashboard', {}, $locale)}>
    <a class={skipAttrs.class} style={skipAttrs.style} href={`#${mainId}`}>{t('nav.skipToContent', {}, $locale)}</a>
    <div class={brandAttrs.class} style={brandAttrs.style}>
      <p class={overlineAttrs.class} style={overlineAttrs.style}>{t('common.projectDashboard', {}, $locale)}</p>
      <strong class={projectAttrs.class} style={projectAttrs.style}><bdi>{projectName}</bdi></strong>
    </div>
    <SidebarNav groups={navGroups} ariaLabel={t('common.projectDashboard', {}, $locale)} />
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
        aria-label={menuOpen ? t('nav.closeProject', {}, $locale) : t('nav.openProject', {}, $locale)}
        onclick={menuOpen ? closeMenu : openMenu}
      >
        <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
          {#if menuOpen}
            <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          {:else}
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          {/if}
        </svg>
        <span><bdi>{menuOpen ? t('common.close', {}, $locale) : t('common.menu', {}, $locale)}</bdi></span>
      </button>
    </div>
    {#if title}
      <header class={headerAttrs.class} style={headerAttrs.style}>
        <h1 class={titleAttrs.class} style={titleAttrs.style}><bdi>{title}</bdi></h1>
        {#if lede}
          <p class={ledeAttrs.class} style={ledeAttrs.style}><bdi>{lede}</bdi></p>
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
  aria-label={t('nav.projectNavigation', {}, $locale)}
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
      <h2 class={sheetTitleAttrs.class} style={sheetTitleAttrs.style}><bdi>{projectName}</bdi></h2>
      <button class={closeAttrs.class} style={closeAttrs.style} type="button" aria-label={t('nav.closeProject', {}, $locale)} onclick={closeMenu}>
        <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        </svg>
      </button>
    </div>
    <SidebarNav groups={navGroups} ariaLabel={t('common.projectDashboard', {}, $locale)} onNavigate={closeMenu} />
  </div>
</dialog>
