<script lang="ts">
  import {
    CHART_HEIGHT,
    CHART_PAD,
    CHART_WIDTH,
    chartLabels,
    formatTick,
    seriesPath,
    valueDomain,
    valueForLabel,
    xForLabel,
    yForValue,
    yTicks,
    type ChartSeries,
  } from './chartModel.js';

  interface Props {
    series: ChartSeries[];
    label?: string;
    range?: string;
    unit?: string;
    class?: string;
  }

  let { series, label = 'Support over time', range = 'Last 30 days', unit, class: className = '' }: Props = $props();

  const labels = $derived(chartLabels(series));
  const domain = $derived(valueDomain(series));
  const ticks = $derived(yTicks(domain));
  const innerWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;

  let activeIndex = $state(0);

  const clampedIndex = $derived(labels.length === 0 ? 0 : Math.min(activeIndex, labels.length - 1));
  const activeLabel = $derived(labels[clampedIndex] ?? '');

  function markerFor(kind: ChartSeries['marker'], x: number, y: number): string {
    if (kind === 'square') {
      return `M${(x - 3.5).toFixed(2)} ${(y - 3.5).toFixed(2)} h7 v7 h-7 z`;
    }
    if (kind === 'diamond') {
      return `M${x.toFixed(2)} ${(y - 5).toFixed(2)} l5 5 l-5 5 l-5 -5 z`;
    }
    return '';
  }

  function onChartKey(event: KeyboardEvent) {
    if (labels.length === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (clampedIndex + 1) % labels.length;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (clampedIndex - 1 + labels.length) % labels.length;
    }
  }

  function seriesTone(index: number): string {
    if (index === 1) return 'var(--pl-moss)';
    if (index === 2) return 'var(--pl-ochre)';
    return 'var(--pl-forest)';
  }
</script>

<figure class="pl-chart {className}">
  <figcaption class="pl-chart__caption">
    <div>
      <h3 class="pl-chart__title">{label}</h3>
      <p class="pl-chart__range">{range}</p>
    </div>
    <ul class="pl-chart__legend">
      {#each series as item, index (item.id)}
        <li class="pl-chart__legend-item" style="--pl-series: {seriesTone(index)}">
          <svg viewBox="0 0 20 10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="19"
              y2="5"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray={item.stroke === 'dashed' ? '4 3' : undefined}
            />
            {#if item.marker === 'square'}
              <rect x="7.5" y="2" width="5" height="5" fill="var(--pl-surface)" stroke="currentColor" />
            {:else if item.marker === 'diamond'}
              <path d="M10 1.5 L13 5 L10 8.5 L7 5 Z" fill="var(--pl-surface)" stroke="currentColor" />
            {:else}
              <circle cx="10" cy="5" r="2.4" fill="var(--pl-surface)" stroke="currentColor" />
            {/if}
          </svg>
          <span>{item.label}</span>
        </li>
      {/each}
    </ul>
  </figcaption>

  {#if labels.length === 0}
    <p class="pl-chart__empty">No points to plot.</p>
  {:else}
    <div
      class="pl-chart__plot pl-focus-ring"
      role="img"
      tabindex="0"
      aria-label="{label}. {range}. Use arrow keys to read each date."
      onkeydown={onChartKey}
    >
      <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" class="pl-chart__svg">
        {#each ticks as tick (tick)}
          {@const y = yForValue(tick, domain)}
          <line
            class="pl-chart__grid"
            x1={CHART_PAD.left}
            x2={CHART_WIDTH - CHART_PAD.right}
            y1={y}
            y2={y}
          />
          <text class="pl-chart__tick" x={CHART_PAD.left - 8} y={y + 3} text-anchor="end">{formatTick(tick)}</text>
        {/each}

        {#each labels as pointLabel, index (pointLabel)}
          {#if index === 0 || index === labels.length - 1 || index % 2 === 0}
            <text
              class="pl-chart__tick"
              x={xForLabel(pointLabel, labels)}
              y={CHART_HEIGHT - 10}
              text-anchor="middle"
            >
              {pointLabel}
            </text>
          {/if}
        {/each}

        {#if activeLabel}
          <line
            class="pl-chart__cursor"
            x1={xForLabel(activeLabel, labels)}
            x2={xForLabel(activeLabel, labels)}
            y1={CHART_PAD.top}
            y2={CHART_HEIGHT - CHART_PAD.bottom}
          />
        {/if}

        {#each series as item, index (item.id)}
          {@const tone = seriesTone(index)}
          <path
            d={seriesPath(item, labels, domain)}
            fill="none"
            stroke={tone}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray={item.stroke === 'dashed' ? '6 5' : undefined}
          />
          {#each item.points as point (point.label)}
            {@const x = xForLabel(point.label, labels)}
            {@const y = yForValue(point.value, domain)}
            {#if item.marker === 'square' || item.marker === 'diamond'}
              <path
                d={markerFor(item.marker, x, y)}
                fill="var(--pl-surface)"
                stroke={tone}
                stroke-width="1.75"
              />
            {:else}
              <circle cx={x} cy={y} r="3.4" fill="var(--pl-surface)" stroke={tone} stroke-width="1.75" />
            {/if}
          {/each}
        {/each}
      </svg>

      {#if activeLabel}
        <div
          class="pl-chart__tooltip"
          style="left: {((xForLabel(activeLabel, labels) - CHART_PAD.left) / innerWidth) * 100}%"
        >
          <strong>{activeLabel}</strong>
          {#each series as item (item.id)}
            {@const value = valueForLabel(item, activeLabel)}
            {#if value !== undefined}
              <span>{item.label} {unit ? `${formatTick(value)} ${unit}` : formatTick(value)}</span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <p class="pl-chart__live" aria-live="polite">
      {activeLabel}
      {#each series as item (item.id)}
        {@const value = valueForLabel(item, activeLabel)}
        {#if value !== undefined}
          · {item.label} {unit ? `${formatTick(value)} ${unit}` : formatTick(value)}
        {/if}
      {/each}
    </p>
  {/if}

  {#if labels.length > 0}
    <table class="pl-chart__table">
      <caption class="pl-chart__table-caption">Values for {label}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          {#each series as item (item.id)}
            <th scope="col">{item.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each labels as pointLabel (pointLabel)}
          <tr class={pointLabel === activeLabel ? 'pl-chart__row--active' : ''}>
            <th scope="row">{pointLabel}</th>
            {#each series as item (item.id)}
              {@const value = valueForLabel(item, pointLabel)}
              <td>{value === undefined ? '—' : unit ? `${formatTick(value)} ${unit}` : formatTick(value)}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</figure>
