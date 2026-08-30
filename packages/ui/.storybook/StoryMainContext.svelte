<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<main aria-labelledby="story-context-title">
  <h1 id="story-context-title">Supporter account</h1>
  {@render children?.()}
</main>
