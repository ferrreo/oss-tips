<script lang="ts">
  import { attrs, display } from '../styles/display.stylex.js';

  export interface Props {
    message: string;
    variant?: 'default' | 'success' | 'error';
  }

  let { message, variant = 'default' }: Props = $props();

  const iconStyles = {
    default: display.toastIconDefault,
    success: display.toastIconSuccess,
    error: display.toastIconError,
  } as const;
  const toastAttrs = attrs(display.toast);
  const iconAttrs = $derived(attrs(display.toastIcon, iconStyles[variant]));
</script>

<div class={toastAttrs.class} style={toastAttrs.style} role={variant === 'error' ? 'alert' : 'status'} aria-live={variant === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
  {#if variant !== 'default'}
    <span class={iconAttrs.class} style={iconAttrs.style} aria-hidden="true">{variant === 'success' ? '✓' : '!'}</span>
  {/if}
  <span class={attrs(display.toastMessage).class}>{message}</span>
</div>
