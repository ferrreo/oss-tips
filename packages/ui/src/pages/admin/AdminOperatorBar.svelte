<script lang="ts">
  interface Props {
    context: string;
    detail?: string;
  }

  let { context, detail }: Props = $props();
</script>

<div class="admin-op-bar" role="status">
  <p class="admin-op-bar__context">{context}</p>
  {#if detail}
    <p class="admin-op-bar__detail">{detail}</p>
  {/if}
</div>

<style>
  .admin-op-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 1rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--pl-border);
    border-left: 4px solid var(--pl-info);
    background: var(--pl-surface);
    border-radius: var(--pl-radius-md);
  }

  .admin-op-bar__context {
    margin: 0;
    font-family: var(--pl-font-ui);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--pl-ink);
  }

  .admin-op-bar__detail {
    margin: 0;
    flex-basis: 100%;
    font-family: var(--pl-font-ui);
    font-size: 0.875rem;
    color: var(--pl-ink-muted);
  }
</style>
