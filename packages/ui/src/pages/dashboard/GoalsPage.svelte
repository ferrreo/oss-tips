<script lang="ts">
  export let title = 'Goals';
  export let project: string;
</script>

<main class="page" data-page="goals">
  <h1>{title}</h1>
  <p class="stub">Page composition stub — replace with full @oss-tips/ui implementation.</p>
  <dl class="meta">
    <div><dt>project</dt><dd>{project}</dd></div>
  </dl>
</main>

<style>
  .page {
    padding: 2rem;
    max-width: 60rem;
    margin: 0 auto;
  }
  .stub {
    color: var(--pl-ink-muted, #667065);
  }
  .meta {
    margin-top: 1.5rem;
    display: grid;
    gap: 0.5rem;
  }
  .meta dt {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--pl-ink-faint, #8b9289);
  }
  .meta dd {
    margin: 0;
    font-family: ui-monospace, monospace;
  }
</style>
