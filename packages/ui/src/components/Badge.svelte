<script lang="ts">
  interface Props {
    variant?: 'default' | 'forest' | 'danger' | 'ochre';
    children?: import('svelte').Snippet;
    /** Visible text when the story (or a caller) does not pass children. */
    label?: string;
  }

  let { variant = 'default', children, label }: Props = $props();
</script>

<span class="pl-badge {variant !== 'default' ? `pl-badge--${variant}` : ''}">
  {#if children}
    {@render children()}
  {:else}
    {label}
  {/if}
</span>
