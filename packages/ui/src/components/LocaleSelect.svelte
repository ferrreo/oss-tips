<script lang="ts">
  import { locale, localeNames, localeShortNames, LOCALES, setLocale, t, type Locale } from '../lib/i18n.js';
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';

  export interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();

  const selectAttrs = $derived(stylex.attrs(controls.localeSelect, controls.focusRing));
  const selectClass = $derived([selectAttrs.class, className].filter(Boolean).join(' '));

  function changeLocale(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (LOCALES.includes(value as Locale)) setLocale(value as Locale);
  }
</script>

<select
  class={selectClass}
  style={selectAttrs.style}
  aria-label={t('nav.language', {}, $locale)}
  title={t('nav.language', {}, $locale)}
  value={$locale}
  onchange={changeLocale}
>
  {#each LOCALES as option}
    <option value={option} title={localeNames[option]}>{localeShortNames[option]}</option>
  {/each}
</select>
