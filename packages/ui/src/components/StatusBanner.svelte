<script lang="ts">
  import { attrs, display } from '../styles/display.stylex.js';

  export interface Props {
    variant?: 'info' | 'warning' | 'danger';
    title: string;
    message?: string;
  }

  let { variant = 'info', title, message }: Props = $props();

  const variantStyles = {
    info: display.statusBannerInfo,
    warning: display.statusBannerWarning,
    danger: display.statusBannerDanger,
  } as const;
  const bannerAttrs = $derived(attrs(display.statusBanner, variantStyles[variant]));
</script>

<div class={bannerAttrs.class} style={bannerAttrs.style} role={variant === 'danger' ? 'alert' : 'status'} aria-live={variant === 'danger' ? undefined : 'polite'} aria-atomic="true">
  <p class={attrs(display.statusTitle).class}>{title}</p>
  {#if message}
    <p class={attrs(display.statusMessage).class}>{message}</p>
  {/if}
</div>
