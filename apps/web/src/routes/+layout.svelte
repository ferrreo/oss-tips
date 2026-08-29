<script lang="ts">
  import '@oss-tips/design-tokens/css';
  import '@oss-tips/ui/styles.css';

  let { children } = $props();
</script>

<div class="app-shell">
  {@render children()}
</div>

<style>
  :global(html, body) {
    margin: 0;
    min-height: 100%;
    background: var(--pl-canvas);
    color: var(--pl-ink);
    font-family:
      'IBM Plex Sans',
      system-ui,
      -apple-system,
      sans-serif;
    line-height: 1.5;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  .app-shell {
    min-height: 100vh;
  }
</style>
