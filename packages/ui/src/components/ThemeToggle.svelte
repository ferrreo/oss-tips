<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';
  import {
    ACCOUNT_PREFERENCE_CHANGE_EVENT,
    locale,
    notifyAccountPreferenceChange,
    t,
    type AccountPreferenceChange,
    type AccountThemePreference,
    type Locale,
  } from '../lib/i18n.js';

  export type ThemePreference = AccountThemePreference;

  export interface Props {
    preference?: ThemePreference;
    onchange?: (preference: ThemePreference) => void;
    class?: string;
  }

  const STORAGE_KEY = 'oss-tips-theme';
  const cycle: Record<ThemePreference, ThemePreference> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  let {
    preference = $bindable<ThemePreference>('system'),
    onchange,
    class: className = '',
  }: Props = $props();

  function isPreference(value: string | null): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
  }

  function applyTheme(next: ThemePreference) {
    if (typeof document === 'undefined') return;
    const resolved = next === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : next;
    document.documentElement.dataset.theme = resolved;
  }

  function setPreference(next: ThemePreference) {
    preference = next;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
    }
    applyTheme(next);
    notifyAccountPreferenceChange({ theme: next });
    onchange?.(next);
  }

  function toggleTheme() {
    setPreference(cycle[preference]);
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (preference === 'system' && isPreference(saved)) preference = saved;
    applyTheme(preference);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      if (preference === 'system') applyTheme('system');
    };
    media.addEventListener('change', syncSystemTheme);
    const syncAccountPreference = (event: Event) => {
      const theme = (event as CustomEvent<AccountPreferenceChange>).detail?.theme;
      if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return;
      preference = theme;
      applyTheme(theme);
    };
    window.addEventListener(ACCOUNT_PREFERENCE_CHANGE_EVENT, syncAccountPreference);
    return () => {
      media.removeEventListener('change', syncSystemTheme);
      window.removeEventListener(ACCOUNT_PREFERENCE_CHANGE_EVENT, syncAccountPreference);
    };
  });

  const toggleAttrs = $derived(stylex.attrs(controls.themeToggle, controls.focusRing));
  const toggleClass = $derived(
    [toggleAttrs.class, className].filter(Boolean).join(' '),
  );
  function preferenceLabel(value: ThemePreference, currentLocale: Locale): string {
    return t(value === 'system' ? 'nav.system' : value === 'light' ? 'nav.light' : 'nav.dark', {}, currentLocale);
  }

  const currentLabel = $derived(preferenceLabel(preference, $locale));
  const nextLabel = $derived(preferenceLabel(cycle[preference], $locale));
</script>

<button
  type="button"
  class={toggleClass}
  style={toggleAttrs.style}
  onclick={toggleTheme}
  aria-label={t('nav.switchTheme', { next: nextLabel, current: currentLabel }, $locale)}
  title={t('nav.switchTheme', { next: nextLabel, current: currentLabel }, $locale)}
>
  {t('nav.theme', {}, $locale)}: {currentLabel}
</button>
