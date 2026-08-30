<script lang="ts">
  import { attrs, display } from '../styles/display.stylex.js';

  export interface Props {
    variant?: 'default' | 'forest' | 'danger' | 'ochre';
    children?: import('svelte').Snippet;
    /** Visible text when the story (or a caller) does not pass children. */
    label?: string;
  }

  let { variant = 'default', children, label }: Props = $props();

  const variantStyles = {
    default: null,
    forest: display.badgeForest,
    danger: display.badgeDanger,
    ochre: display.badgeOchre,
  } as const;
  const badgeAttrs = $derived(attrs(display.badge, variantStyles[variant]));
</script>

<span class={badgeAttrs.class} style={badgeAttrs.style}>
  {#if children}
    {@render children()}
  {:else}
    {label}
  {/if}
</span>
