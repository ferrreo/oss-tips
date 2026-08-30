<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { currencyExponent } from '@oss-tips/domain/money';
  import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';
  import {
    CHART_HEIGHT,
    CHART_PAD,
    CHART_WIDTH,
    chartLabels,
    seriesPath,
    valueDomain,
    valueForLabel,
    xForLabel,
    yForValue,
    yTicks,
    type ChartSeries,
  } from './chartModel.js';
  import { visuals } from '../styles/visuals.stylex.js';
  import { formatCurrency, formatDate, formatNumber, locale, t, type Locale } from '../lib/i18n.js';

  export interface Props {
    series: ChartSeries[];
    label?: string;
    range?: string;
    valuePrefix?: string;
    currency?: string;
    unit?: string;
    class?: string;
  }

  let {
    series,
    label,
    range,
    valuePrefix = '',
    currency,
    unit = '',
    class: className = '',
  }: Props = $props();

  const labels = $derived(chartLabels(series));
  const domain = $derived(valueDomain(series));
  const ticks = $derived(yTicks(domain));
  const innerWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;

  let activeIndex = $state(0);

  const clampedIndex = $derived(labels.length === 0 ? 0 : Math.min(activeIndex, labels.length - 1));
  const activeLabel = $derived(labels[clampedIndex] ?? '');
  const activeXPercent = $derived(
    activeLabel ? ((xForLabel(activeLabel, labels) - CHART_PAD.left) / innerWidth) * 100 : 50,
  );
  const tooltipAlignment = $derived(activeXPercent <= 0 ? 'start' : activeXPercent >= 100 ? 'end' : 'center');

  const rootClass = $derived(`${stylex.attrs(visuals.chart).class ?? ''} ${className}`.trim());
  const tooltipAttrs = $derived(
    stylex.attrs(
      visuals.chartTooltip,
      visuals.chartTooltipPosition(`${activeXPercent}%`),
      tooltipAlignment === 'start' && visuals.chartTooltipStart,
      tooltipAlignment === 'end' && visuals.chartTooltipEnd,
    ),
  );

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
    if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = 0;
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      activeIndex = labels.length - 1;
      return;
    }
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
    if (index === 1) return paperlight.moss;
    if (index === 2) return paperlight.ochre;
    return paperlight.forest;
  }

  function valueLabel(item: ChartSeries, pointLabel: string): string | undefined {
    const value = valueForLabel(item, pointLabel);
    if (value === undefined) return undefined;
    const formatted = currency
      ? formatCurrency(Math.round(value * 10 ** currencyExponent(currency)), currency, $locale)
      : `${valuePrefix}${formatChartNumber(value, $locale)}`;
    return unit ? `${formatted} ${unit}` : formatted;
  }

  function formatChartNumber(value: number, currentLocale: Locale): string {
    if (Math.abs(value) >= 1000) {
      return `${formatNumber(Math.round(value / 100) / 10, currentLocale)}k`;
    }
    return formatNumber(value, currentLocale, { maximumFractionDigits: 1 });
  }

  function displayPointLabel(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed, $locale);
  }

  function onChartClick(event: MouseEvent) {
    if (labels.length === 0) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    activeIndex = Math.round(t * (labels.length - 1));
  }
</script>

<figure class={rootClass}>
  <figcaption class={stylex.attrs(visuals.chartCaption).class}>
    <div>
      <h2 class={stylex.attrs(visuals.chartTitle).class}>{label ?? t('common.supportOverTime', {}, $locale)}</h2>
      <p class={stylex.attrs(visuals.chartRange).class}>{range ?? t('common.last30Days', {}, $locale)}</p>
    </div>
    <ul class={stylex.attrs(visuals.chartLegend).class}>
      {#each series as item, index (item.id)}
        {@const tone = seriesTone(index)}
        <li class={stylex.attrs(visuals.chartLegendItem).class}>
          <svg class={stylex.attrs(visuals.chartLegendSwatch).class} viewBox="0 0 20 10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="19"
              y2="5"
              stroke={tone}
              stroke-width="2"
              stroke-dasharray={item.stroke === 'dashed' ? '4 3' : undefined}
            />
            {#if item.marker === 'square'}
              <rect x="7.5" y="2" width="5" height="5" fill={paperlight.surface} stroke={tone} />
            {:else if item.marker === 'diamond'}
              <path d="M10 1.5 L13 5 L10 8.5 L7 5 Z" fill={paperlight.surface} stroke={tone} />
            {:else}
              <circle cx="10" cy="5" r="2.4" fill={paperlight.surface} stroke={tone} />
            {/if}
          </svg>
          <span>{item.label}</span>
        </li>
      {/each}
    </ul>
  </figcaption>

  {#if labels.length === 0}
    <p class={stylex.attrs(visuals.chartEmpty).class}>{t('common.noChartPoints', {}, $locale)}</p>
  {:else}
    <div
      class={stylex.attrs(visuals.chartPlot).class}
    >
      <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" class={stylex.attrs(visuals.chartSvg).class} aria-hidden="true">
        {#each ticks as tick (tick)}
          {@const y = yForValue(tick, domain)}
          <line
            class={stylex.attrs(visuals.chartGrid).class}
            x1={CHART_PAD.left}
            x2={CHART_WIDTH - CHART_PAD.right}
            y1={y}
            y2={y}
          />
          <text class={stylex.attrs(visuals.chartTick).class} x={CHART_PAD.left - 8} y={y + 3} text-anchor="end">{formatChartNumber(tick, $locale)}</text>
        {/each}

        {#each labels as pointLabel, index (pointLabel)}
          {#if index === 0 || index === labels.length - 1 || index % 2 === 0}
            <text
              class={stylex.attrs(visuals.chartTick).class}
              x={xForLabel(pointLabel, labels)}
              y={CHART_HEIGHT - 10}
              text-anchor="middle"
            >
              {displayPointLabel(pointLabel)}
            </text>
          {/if}
        {/each}

        {#if activeLabel}
          <line
            class={stylex.attrs(visuals.chartCursor).class}
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
                fill={paperlight.surface}
                stroke={tone}
                stroke-width="1.75"
              />
            {:else}
              <circle cx={x} cy={y} r="3.4" fill={paperlight.surface} stroke={tone} stroke-width="1.75" />
            {/if}
          {/each}
        {/each}
      </svg>

      <button
        type="button"
        class={stylex.attrs(visuals.chartPlotControl).class}
        aria-label={t('common.chartKeyboard', { label, range }, $locale)}
        onclick={onChartClick}
        onkeydown={onChartKey}
      ></button>

      {#if activeLabel}
        <div
          class={tooltipAttrs.class}
          style={tooltipAttrs.style}
          role="tooltip"
        >
          <strong>{displayPointLabel(activeLabel)}</strong>
          {#each series as item (item.id)}
            {@const value = valueLabel(item, activeLabel)}
            {#if value !== undefined}
              <span>{item.label} {value}</span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <p class={stylex.attrs(visuals.chartLive).class} aria-live="polite">
      {displayPointLabel(activeLabel)}
      {#each series as item (item.id)}
        {@const value = valueLabel(item, activeLabel)}
        {#if value !== undefined}
          · {item.label} {value}
        {/if}
      {/each}
    </p>
  {/if}

  {#if labels.length > 0}
    <table class={stylex.attrs(visuals.chartTable).class}>
      <caption class={stylex.attrs(visuals.chartTableCaption).class}>{t('common.valuesFor', { label }, $locale)}</caption>
      <thead>
        <tr>
          <th class={stylex.attrs(visuals.chartTableCell).class} scope="col">{t('common.date', {}, $locale)}</th>
          {#each series as item (item.id)}
            <th class={stylex.attrs(visuals.chartTableCell).class} scope="col">{item.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each labels as pointLabel (pointLabel)}
          <tr class={pointLabel === activeLabel ? stylex.attrs(visuals.chartTableRowActive).class : undefined}>
            <th class={stylex.attrs(visuals.chartTableCell).class} scope="row">{displayPointLabel(pointLabel)}</th>
            {#each series as item (item.id)}
              {@const value = valueLabel(item, pointLabel)}
              <td class={stylex.attrs(visuals.chartTableCell).class}>{value ?? t('common.notAvailable', {}, $locale)}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>

    <details class={stylex.attrs(visuals.chartMobileDisclosure).class}>
      <summary class={stylex.attrs(visuals.chartMobileSummary).class}>{t('common.valuesFor', { label }, $locale)}</summary>
      <ul class={stylex.attrs(visuals.chartMobileData).class} aria-label={t('common.valuesFor', { label }, $locale)}>
        {#each labels as pointLabel (pointLabel)}
          <li
            class={pointLabel === activeLabel
              ? stylex.attrs(visuals.chartMobileRow, visuals.chartMobileRowActive).class
              : stylex.attrs(visuals.chartMobileRow).class}
          >
            <span class={stylex.attrs(visuals.chartMobileDate).class}>{displayPointLabel(pointLabel)}</span>
            <dl class={stylex.attrs(visuals.chartMobileValues).class}>
              {#each series as item (item.id)}
                <div class={stylex.attrs(visuals.chartMobileValue).class}>
                  <dt class={stylex.attrs(visuals.chartMobileLabel).class}>{item.label}</dt>
                  <dd class={stylex.attrs(visuals.chartMobileNumber).class}>{valueLabel(item, pointLabel) ?? t('common.notAvailable', {}, $locale)}</dd>
                </div>
              {/each}
            </dl>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</figure>
