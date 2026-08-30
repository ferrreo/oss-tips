<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { formatCadence, formatCurrency, locale, t } from '../lib/i18n.js';
  import { funding } from '../styles/funding.stylex.js';

  export interface Props {
    projectAmountMinor: number;
    projectFeePercent?: number;
    tipMinor?: number;
    currency?: string;
    cadence?: string;
    headingLevel?: 2 | 3;
  }

  let {
    projectAmountMinor,
    projectFeePercent = 5,
    tipMinor = 0,
    currency = 'GBP',
    cadence = 'one-off',
    headingLevel = 3,
  }: Props = $props();

  const projectFeeMinor = $derived(Math.max(0, Math.round(projectAmountMinor * (projectFeePercent / 100))));
  const totalMinor = $derived(Math.max(0, projectAmountMinor + projectFeeMinor + tipMinor));
  const headingTag = $derived(headingLevel === 2 ? 'h2' : 'h3');
</script>

<aside class={stylex.attrs(funding.feeDisclosure).class ?? ''} aria-label={t('common.feeBreakdown', {}, $locale)}>
  <svelte:element this={headingTag} class={stylex.attrs(funding.feeHeading).class ?? ''}>{t('common.beforeConfirm', {}, $locale)}</svelte:element>
  <dl class={stylex.attrs(funding.feeList).class ?? ''}>
    <div class={stylex.attrs(funding.feeRow).class ?? ''}>
      <dt class={stylex.attrs(funding.feeRowLabel).class ?? ''}>{t('common.projectReceives', {}, $locale)}</dt>
      <dd class={stylex.attrs(funding.feeRowValue).class ?? ''}>{formatCurrency(projectAmountMinor, currency, $locale)}</dd>
    </div>
    <div class={stylex.attrs(funding.feeRow).class ?? ''}>
      <dt class={stylex.attrs(funding.feeRowLabel).class ?? ''}>{t('common.projectFee', { percent: projectFeePercent }, $locale)}</dt>
      <dd class={stylex.attrs(funding.feeRowValue).class ?? ''}>{formatCurrency(projectFeeMinor, currency, $locale)}</dd>
    </div>
  {#if tipMinor > 0}
    <div class={stylex.attrs(funding.feeRow).class ?? ''}>
      <dt class={stylex.attrs(funding.feeRowLabel).class ?? ''}>{t('common.platformTip', {}, $locale)}</dt>
      <dd class={stylex.attrs(funding.feeRowValue).class ?? ''}>{formatCurrency(tipMinor, currency, $locale)}</dd>
    </div>
  {/if}
    <div class={stylex.attrs(funding.feeRow, funding.feeMeta).class ?? ''}>
      <dt>{t('common.cadence', {}, $locale)}</dt>
      <dd class={stylex.attrs(funding.feeRowValue).class ?? ''}>{formatCadence(cadence, $locale)}</dd>
    </div>
    <div class={stylex.attrs(funding.feeRow, funding.feeTotal).class ?? ''}>
      <dt>{t('common.youPayToday', {}, $locale)}</dt>
      <dd class={stylex.attrs(funding.feeRowValue).class ?? ''}>{formatCurrency(totalMinor, currency, $locale)}</dd>
    </div>
  </dl>
  <p class={stylex.attrs(funding.feeNote).class ?? ''}>
    {t('common.paymentNote', {}, $locale)}
  </p>
</aside>
