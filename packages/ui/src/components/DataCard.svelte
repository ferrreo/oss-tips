<script lang="ts">
  interface Props {
    label: string;
    value: string;
    compare?: string;
    compareDirection?: 'up' | 'down' | 'neutral';
    sparkline?: number[];
  }

  let { label, value, compare, compareDirection = 'neutral', sparkline }: Props = $props();

  const compareText = $derived(
    compare ?? (compareDirection === 'up' ? 'Up' : compareDirection === 'down' ? 'Down' : ''),
  );

  const sparkPath = $derived.by(() => {
    const values = sparkline;
    if (!values || values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    return values
      .map((point, index) => {
        const x = (index / (values.length - 1)) * 64;
        const y = 18 - ((point - min) / span) * 16;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  });
</script>

<div class="pl-data-card">
  <div class="pl-data-card__head">
    <div class="pl-data-card__label">{label}</div>
    {#if sparkPath}
      <svg class="pl-data-card__spark" viewBox="0 0 64 20" aria-hidden="true">
        <path d={sparkPath} fill="none" stroke="var(--pl-moss)" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    {/if}
  </div>
  <div class="pl-data-card__value">{value}</div>
  {#if compareText}
    <div
      class="pl-data-card__compare {compareDirection === 'up'
        ? 'pl-data-card__compare--up'
        : ''} {compareDirection === 'down' ? 'pl-data-card__compare--down' : ''}"
    >
      {#if compareDirection === 'up'}
        <span class="pl-data-card__arrow" aria-hidden="true">↑</span>
        {#if compare}
          <span class="pl-data-card__sr">Up. </span>
        {/if}
      {:else if compareDirection === 'down'}
        <span class="pl-data-card__arrow" aria-hidden="true">↓</span>
        {#if compare}
          <span class="pl-data-card__sr">Down. </span>
        {/if}
      {/if}
      {compareText}
    </div>
  {/if}
</div>
