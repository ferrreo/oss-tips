<script lang="ts">
  interface Props {
    label: string;
    value: string;
    compare?: string;
    compareDirection?: 'up' | 'down' | 'neutral';
  }

  let { label, value, compare, compareDirection = 'neutral' }: Props = $props();
</script>

<div class="pl-data-card">
  <div class="pl-data-card__label">{label}</div>
  <div class="pl-data-card__value">{value}</div>
  {#if compare}
    <div
      class="pl-data-card__compare {compareDirection === 'up' ? 'pl-data-card__compare--up' : ''} {compareDirection === 'down' ? 'pl-data-card__compare--down' : ''}"
    >
      {compare}
    </div>
  {/if}
</div>
