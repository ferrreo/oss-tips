<script lang="ts">
  function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') ?? 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
  }
</script>

<button type="button" class="pl-theme-toggle pl-focus-ring" onclick={toggleTheme} aria-label="Toggle theme">
  Theme
</button>
