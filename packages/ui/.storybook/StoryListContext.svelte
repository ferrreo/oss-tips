<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<main aria-labelledby="story-context-title">
  <h1 id="story-context-title">Security settings</h1>
  <ul aria-label="Security items">
    {@render children?.()}
  </ul>
</main>
