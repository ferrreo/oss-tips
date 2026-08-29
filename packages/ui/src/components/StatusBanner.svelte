<script lang="ts">
  interface Props {
    variant?: 'info' | 'warning' | 'danger';
    title: string;
    message?: string;
  }

  let { variant = 'info', title, message }: Props = $props();
</script>

<div class="pl-status-banner pl-status-banner--{variant}" role="status">
  <p class="pl-status-banner__title">{title}</p>
  {#if message}
    <p class="pl-status-banner__message">{message}</p>
  {/if}
</div>
