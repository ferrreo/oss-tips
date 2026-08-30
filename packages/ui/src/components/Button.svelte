<script lang="ts">
  import type { Snippet } from 'svelte';
  import { locale, t } from '../lib/i18n.js';
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls, variants } from '../styles/controls.stylex';

  export interface Props {
    variant?: 'primary' | 'secondary' | 'quiet' | 'destructive' | 'icon';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    /** Visible text when the story (or a caller) does not pass children. */
    label?: string;
    class?: string;
    'aria-label'?: string;
  }

  let {
    variant = 'primary',
    loading = false,
    disabled = false,
    type = 'button',
    onclick,
    children,
    label,
    class: className = '',
    'aria-label': ariaLabel,
  }: Props = $props();

  const buttonAttrs = $derived(
    stylex.attrs(
      controls.button,
      variants[variant],
      variant === 'icon' ? controls.buttonIcon : null,
      loading ? controls.buttonLoading : null,
      disabled ? controls.buttonDisabled : null,
      controls.focusRing,
    ),
  );
  const buttonClass = $derived(
    [buttonAttrs.class, className].filter(Boolean).join(' '),
  );
  const accessibleLoadingLabel = $derived(
    ariaLabel ?? t('common.loading', {}, $locale),
  );
  const contentAttrs = $derived(
    stylex.attrs(controls.buttonContent, loading ? controls.buttonContentHidden : null),
  );
  const loadingLabelAttrs = $derived(stylex.attrs(controls.buttonLoadingLabel));
</script>

<button
  type={type}
  class={buttonClass}
  style={buttonAttrs.style}
  disabled={disabled || loading}
  aria-busy={loading}
  aria-label={loading ? accessibleLoadingLabel : ariaLabel}
  onclick={onclick}
>
  <span
    class={contentAttrs.class}
    style={contentAttrs.style}
    aria-hidden={loading}
  >
    <bdi>
      {#if children}
        {@render children()}
      {:else}
        {label}
      {/if}
    </bdi>
  </span>
  {#if loading}
    <span
      class={loadingLabelAttrs.class}
      style={loadingLabelAttrs.style}
      role="status"
      aria-live="polite"
    ><bdi>{t('common.loading', {}, $locale)}</bdi></span>
  {/if}
</button>
