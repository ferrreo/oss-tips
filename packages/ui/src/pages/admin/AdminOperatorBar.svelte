<script lang="ts">
  interface Props {
    context: string;
    detail?: string;
  }

  let { context, detail }: Props = $props();
</script>

<div class="admin-op-bar" role="status">
  <p class="admin-op-bar__kicker">Platform operator</p>
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
    gap: 0.5rem 1rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    border: 1px solid color-mix(in srgb, var(--pl-info) 35%, var(--pl-border));
    border-left: 4px solid var(--pl-info);
    background: color-mix(in srgb, var(--pl-info) 10%, var(--pl-surface));
    border-radius: var(--pl-radius-md);
  }

  .admin-op-bar__kicker {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pl-info);
  }

  .admin-op-bar__context {
    margin: 0;
    font-weight: 600;
  }

  .admin-op-bar__detail {
    margin: 0;
    flex-basis: 100%;
    font-size: 0.875rem;
    color: var(--pl-ink-muted);
  }
</style>
