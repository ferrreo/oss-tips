<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';
  import { formatCurrency, formatNumber, locale, t, type Locale } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface TransparencyCard {
    label: string;
    value: string;
    compare?: string;
    compareDirection: 'up' | 'down' | 'neutral';
    sparkline?: number[];
  }

  interface TransparencyColumn {
    key: string;
    label: string;
  }

  export interface TransparencyAggregate {
    publishedProjects: number;
    settledSupport: Array<{ currency: string; amountMinor: string }>;
    medianProjectFeePercent: number | null;
    guestOneOffSharePercent: number | null;
    refundedSupport: Array<{ currency: string; percent: number }>;
    activeMemberships: number;
  }

  export interface Props {
    lead?: string;
    cards?: TransparencyCard[];
    columns?: TransparencyColumn[];
    rows?: Record<string, string | number>[];
    state?: 'ready' | 'empty' | 'error';
    aggregate?: TransparencyAggregate;
  }

  function formatMinor(value: string, currency: string, currentLocale: Locale): string {
    try {
      return formatCurrency(BigInt(value), currency, currentLocale);
    } catch {
      return '—';
    }
  }

  function formatMoneyTotals(totals: TransparencyAggregate['settledSupport'], currentLocale: Locale): string {
    return totals
      .map((total) => formatMinor(total.amountMinor, total.currency, currentLocale))
      .join(' · ') || '—';
  }

  function formatPercentValue(value: number | null, currentLocale: Locale): string {
    return value === null || !Number.isFinite(value)
      ? '—'
      : formatNumber(value / 100, currentLocale, { style: 'percent', maximumFractionDigits: 1 });
  }

  function formatRateTotals(rates: TransparencyAggregate['refundedSupport'], currentLocale: Locale): string {
    return rates
      .map((rate) => {
        const value = formatPercentValue(rate.percent, currentLocale);
        return rates.length > 1 ? `${value} ${rate.currency}` : value;
      })
      .join(' · ') || '—';
  }

  function cardsFromAggregate(aggregate: TransparencyAggregate, currentLocale: Locale): TransparencyCard[] {
    return [
      { label: t('public.transparency.projectsPublished', {}, currentLocale), value: formatNumber(aggregate.publishedProjects, currentLocale), compareDirection: 'neutral' },
      { label: t('public.transparency.supportProcessed', {}, currentLocale), value: formatMoneyTotals(aggregate.settledSupport, currentLocale), compare: t('public.transparency.settledVolume', {}, currentLocale), compareDirection: 'neutral' },
      { label: t('public.transparency.medianFee', {}, currentLocale), value: formatPercentValue(aggregate.medianProjectFeePercent, currentLocale), compareDirection: 'neutral' },
      { label: t('public.transparency.guestShare', {}, currentLocale), value: formatPercentValue(aggregate.guestOneOffSharePercent, currentLocale), compare: t('public.transparency.settledOneOffs', {}, currentLocale), compareDirection: 'neutral' },
      { label: t('public.transparency.refunded', {}, currentLocale), value: formatRateTotals(aggregate.refundedSupport, currentLocale), compare: t('public.transparency.ofSettledVolume', {}, currentLocale), compareDirection: 'neutral' },
      { label: t('public.transparency.memberships', {}, currentLocale), value: formatNumber(aggregate.activeMemberships, currentLocale), compareDirection: 'neutral' },
    ];
  }

  let {
    lead,
    cards,
    columns,
    rows,
    state = 'ready',
    aggregate,
  }: Props = $props();

  const displayLead = $derived(lead ?? t('public.transparency.lead', {}, $locale));
  const aggregateCards = $derived.by(() => aggregate ? cardsFromAggregate(aggregate, $locale) : []);
  const displayCards = $derived(cards ?? aggregateCards);
  const displayState = $derived(state === 'ready' && !cards && !aggregate ? 'empty' : state);
  const displayColumns = $derived(columns ?? [
    { key: 'rule', label: t('public.transparency.rule', {}, $locale) },
    { key: 'detail', label: t('public.transparency.detail', {}, $locale) },
  ]);
  const displayRows = $derived(rows ?? [
    { rule: t('public.transparency.settlementOnly', {}, $locale), detail: t('public.transparency.settlementDetail', {}, $locale) },
    { rule: t('public.transparency.noVanityRank', {}, $locale), detail: t('public.transparency.noVanityDetail', {}, $locale) },
    { rule: t('public.transparency.tipsExcluded', {}, $locale), detail: t('public.transparency.tipsDetail', {}, $locale) },
    { rule: t('public.transparency.refundsSubtracted', {}, $locale), detail: t('public.transparency.refundsDetail', {}, $locale) },
  ]);

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.transparency.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{t('public.transparency.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{displayLead}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        {#if displayState === 'error'}
          <p class={stylex.attrs(publicStyles.muted).class}>{t('public.transparency.error', {}, $locale)}</p>
        {:else if displayState === 'empty'}
          <p class={stylex.attrs(publicStyles.muted).class}>{t('public.transparency.empty', {}, $locale)}</p>
        {:else}
          <div class={stylex.attrs(publicStyles.grid).class}>
            {#each displayCards as card (card.label)}
              <DataCard
                label={card.label}
                value={card.value}
                compareDirection={card.compareDirection}
                {...(card.compare === undefined ? {} : { compare: card.compare })}
                {...(card.sparkline === undefined ? {} : { sparkline: card.sparkline })}
              />
            {/each}
          </div>
          <div class={stylex.attrs(publicStyles.prose).class}>
            <h2>{t('public.transparency.howReport', {}, $locale)}</h2>
            <p>{t('public.transparency.howReportBody', {}, $locale)}</p>
          </div>
          <Table columns={displayColumns} rows={displayRows} caption={t('public.transparency.reportingRules', {}, $locale)} />
        {/if}
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
