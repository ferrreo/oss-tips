<script lang="ts">
  import { stylex } from '$lib/stylex-runtime.js';
  import { paperlightDark } from '@oss-tips/design-tokens/paperlight.stylex';
  import '@oss-tips/design-tokens/css';
  import '@oss-tips/ui/styles.css';
  import {
    ACCOUNT_PREFERENCE_CHANGE_EVENT,
    initLocale,
    isLocale,
    locale,
    notifyAccountPreferenceChange,
    setLocale,
    t,
    type AccountPreferenceChange,
    type AccountThemePreference,
  } from '@oss-tips/ui/lib/i18n.js';
  import { layoutStyles } from './layout.stylex.js';

  let { children, data } = $props();
  let preferenceSave = Promise.resolve();

  const darkThemeClasses = stylex.attrs(paperlightDark).class?.split(/\s+/).filter(Boolean) ?? [];

  if (import.meta.env.DEV) {
    // @ts-expect-error virtual module supplied by @stylexjs/unplugin in development
    void import('virtual:stylex:runtime');
  }

  $effect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => {
      for (const className of darkThemeClasses) {
        root.classList.toggle(className, root.dataset.theme === 'dark');
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  $effect(() => {
    initLocale();
  });

  function isThemePreference(value: unknown): value is AccountThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
  }

  function applyAccountTheme(preference: AccountThemePreference): void {
    if (typeof document === 'undefined') return;
    const resolved = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem('oss-tips-theme', preference);
    } catch {
      // The account preference still applies for this session when storage is unavailable.
    }
  }

  function persistAccountPreference(event: Event): void {
    if (!data?.accountPreferences || typeof window === 'undefined') return;
    const detail = (event as CustomEvent<AccountPreferenceChange>).detail;
    if (!detail || detail.source === 'account') return;
    const patch: AccountPreferenceChange = {};
    if (detail.theme !== undefined && isThemePreference(detail.theme)) patch.theme = detail.theme;
    if (detail.locale !== undefined && isLocale(detail.locale)) patch.locale = detail.locale;
    if (patch.theme === undefined && patch.locale === undefined) return;
    preferenceSave = preferenceSave
      .then(async () => {
        const response = await fetch('/api/v1/me/preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(patch),
        });
        if (!response.ok) throw new Error(`Preference update failed (${response.status})`);
      })
      .catch((cause: unknown) => {
        console.error('[account] Failed to save account preference', cause);
      });
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener(ACCOUNT_PREFERENCE_CHANGE_EVENT, persistAccountPreference);
    return () => window.removeEventListener(ACCOUNT_PREFERENCE_CHANGE_EVENT, persistAccountPreference);
  });

  $effect(() => {
    const preferences = data?.accountPreferences;
    if (!preferences || typeof document === 'undefined') return;
    setLocale(preferences.locale, { persist: true, syncAccount: false });
    applyAccountTheme(preferences.themePreference);
    notifyAccountPreferenceChange({
      theme: preferences.themePreference,
      locale: preferences.locale,
      source: 'account',
    });
  });
</script>

<svelte:head>
  <title>{t('common.documentTitle', {}, $locale)}</title>
</svelte:head>

<div {...stylex.attrs(layoutStyles.shell)}>
  {@render children()}
</div>
