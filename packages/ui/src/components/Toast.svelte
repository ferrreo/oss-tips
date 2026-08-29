<script lang="ts">
  interface Props {
    message: string;
    variant?: 'default' | 'success' | 'error';
  }

  let { message, variant = 'default' }: Props = $props();
</script>

<div class="pl-toast" role="status" aria-live="polite">
  {#if variant === 'success'}
    <span style="color: var(--pl-success);">✓</span>
  {:else if variant === 'error'}
    <span style="color: var(--pl-danger);">!</span>
  {/if}
  <span>{message}</span>
</div>
