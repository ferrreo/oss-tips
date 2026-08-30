<script lang="ts">
  import { attrs, display } from '../styles/display.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';
  import { locale, t } from '../lib/i18n.js';

  export interface Props {
    label: string;
    value: string;
    compare?: string;
    compareDirection?: 'up' | 'down' | 'neutral';
    sparkline?: number[];
  }

  let { label, value, compare, compareDirection = 'neutral', sparkline }: Props = $props();

  const cardAttrs = attrs(display.dataCard);
  const headAttrs = attrs(display.dataCardHead);
  const labelAttrs = attrs(display.dataCardLabel);
  const sparkAttrs = attrs(display.dataCardSpark);
  const sparkPathAttrs = attrs(display.dataCardSparkPath);
  const valueAttrs = attrs(display.dataCardValue);
  const compareStyles = {
    neutral: null,
    up: display.dataCardCompareUp,
    down: display.dataCardCompareDown,
  } as const;
  const compareAttrs = $derived(attrs(display.dataCardCompare, compareStyles[compareDirection]));
  const arrowAttrs = attrs(display.dataCardArrow);

  const compareText = $derived(
    compare ?? (compareDirection === 'up' ? t('common.up', {}, $locale) : compareDirection === 'down' ? t('common.down', {}, $locale) : ''),
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

<div class={cardAttrs.class} style={cardAttrs.style}>
  <div class={headAttrs.class} style={headAttrs.style}>
    <div class={labelAttrs.class} style={labelAttrs.style}><bdi>{label}</bdi></div>
    {#if sparkPath}
      <svg class={sparkAttrs.class} style={sparkAttrs.style} viewBox="0 0 64 20" aria-hidden="true">
        <path {...sparkPathAttrs} d={sparkPath} />
      </svg>
    {/if}
  </div>
  <div class={valueAttrs.class} style={valueAttrs.style}><bdi>{value}</bdi></div>
  {#if compareText}
    <div class={compareAttrs.class} style={compareAttrs.style}>
      {#if compareDirection === 'up'}
        <span class={arrowAttrs.class} style={arrowAttrs.style} aria-hidden="true">↑</span>
        {#if compare}
          <span class={attrs(primitives.srOnly).class}><bdi>{t('common.up', {}, $locale)}</bdi> </span>
        {/if}
      {:else if compareDirection === 'down'}
        <span class={arrowAttrs.class} style={arrowAttrs.style} aria-hidden="true">↓</span>
        {#if compare}
          <span class={attrs(primitives.srOnly).class}><bdi>{t('common.down', {}, $locale)}</bdi> </span>
        {/if}
      {/if}
      <bdi>{compareText}</bdi>
    </div>
  {/if}
</div>
