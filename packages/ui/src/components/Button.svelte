<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'quiet' | 'destructive' | 'icon';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
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
    class: className = '',
    'aria-label': ariaLabel,
  }: Props = $props();

  const variantClass = $derived(`pl-btn--${variant}`);
</script>

<button
  type={type}
  class="pl-btn pl-focus-ring {variantClass} {loading ? 'pl-btn--loading' : ''} {className}"
  disabled={disabled || loading}
  aria-busy={loading}
  aria-label={ariaLabel}
  onclick={onclick}
>
  {#if loading}
    <span class="pl-muted">Loading…</span>
  {:else}
    {@render children?.()}
  {/if}
</button>
