<script lang="ts">
  interface Props {
    variant?: 'default' | 'forest' | 'danger' | 'ochre';
    children?: import('svelte').Snippet;
  }

  let { variant = 'default', children }: Props = $props();
</script>

<span class="pl-badge {variant !== 'default' ? `pl-badge--${variant}` : ''}">
  {@render children?.()}
</span>
