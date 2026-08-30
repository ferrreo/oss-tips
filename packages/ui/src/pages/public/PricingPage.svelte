<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import Table from '../../components/Table.svelte';
  import { formatCurrency, locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  interface PricingMode {
    heading: string;
    body: string;
  }

  interface PricingColumn {
    key: string;
    label: string;
  }

  export interface Props {
    lead?: string;
    modes?: PricingMode[];
    columns?: PricingColumn[];
    rows?: Record<string, string | number>[];
    exampleAmountMinor?: number;
    exampleTipMinor?: number;
    currency?: string;
  }

  let {
    lead,
    modes,
    columns,
    rows,
    exampleAmountMinor = 2500,
    exampleTipMinor = 100,
    currency = 'USD',
  }: Props = $props();

  const displayLead = $derived(lead ?? t('public.pricing.lead', {}, $locale));
  const displayModes = $derived(modes ?? [
    { heading: t('public.pricing.standardHeading', {}, $locale), body: t('public.pricing.standardBody', {}, $locale) },
    { heading: t('public.pricing.absorbedHeading', {}, $locale), body: t('public.pricing.absorbedBody', {}, $locale) },
  ]);
  const displayColumns = $derived(columns ?? [
    { key: 'item', label: t('public.pricing.shownBeforeCheckout', {}, $locale) },
    { key: 'standard', label: t('public.pricing.standard', {}, $locale) },
    { key: 'absorbed', label: t('public.pricing.absorbed', {}, $locale) },
  ]);
  const displayRows = $derived(rows ?? [
    { item: t('public.pricing.projectReceives', {}, $locale), standard: formatCurrency(1000, currency, $locale), absorbed: formatCurrency(1000, currency, $locale) },
    { item: t('public.pricing.projectFee', {}, $locale), standard: `${formatCurrency(50, currency, $locale)} (5%)`, absorbed: t('public.pricing.toSupporter', { amount: formatCurrency(0, currency, $locale) }, $locale) },
    { item: t('public.pricing.optionalTip', {}, $locale), standard: t('public.pricing.toAny', { amount: formatCurrency(0, currency, $locale) }, $locale), absorbed: t('public.pricing.toAny', { amount: formatCurrency(0, currency, $locale) }, $locale) },
    { item: t('public.pricing.stripeProcessing', {}, $locale), standard: t('public.pricing.atCheckout', {}, $locale), absorbed: t('public.pricing.atCheckout', {}, $locale) },
  ]);

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.pricing.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.heroTitle).class}>{t('public.pricing.title', {}, $locale)}</h1>
        <p class={stylex.attrs(publicStyles.lead).class}>{displayLead}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.prose).class}>
          {#each displayModes as mode (mode.heading)}
            <h2>{mode.heading}</h2>
            <p>{mode.body}</p>
          {/each}
          <h2>{t('public.pricing.whoPays', {}, $locale)}</h2>
        </div>
        <Table columns={displayColumns} rows={displayRows} caption={t('public.pricing.exampleCaption', { amount: formatCurrency(1000, currency, $locale) }, $locale)} />
        <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{t('public.pricing.exampleDisclosure', {}, $locale)}</h2>
        <FeeDisclosure projectAmountMinor={exampleAmountMinor} projectFeePercent={5} tipMinor={exampleTipMinor} cadence="monthly" {currency} />
        <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}>{t('public.pricing.localCurrency', {}, $locale)}</p>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
