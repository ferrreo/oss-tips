<script lang="ts">
  interface Props {
    variant?: 'info' | 'warning' | 'danger';
    title: string;
    message?: string;
  }

  let { variant = 'info', title, message }: Props = $props();
</script>

<div class="pl-status-banner pl-status-banner--{variant}" role="status">
  <strong>{title}</strong>
  {#if message}
    <p style="margin: 0.25rem 0 0; font-size: 0.875rem;">{message}</p>
  {/if}
</div>
