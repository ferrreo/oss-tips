<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import SegmentedControl from './SegmentedControl.svelte';
  import TextField from './TextField.svelte';
  import { currencyExponent } from '@oss-tips/domain/money';
  import { formatCadence, formatCurrency, locale, t } from '../lib/i18n.js';
  import { funding } from '../styles/funding.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';

  export interface Props {
    currency?: string;
    presets?: number[];
    cadence?: string;
    selectedAmountMinor?: number;
    minAmountMinor?: number;
    maxAmountMinor?: number;
    embedded?: boolean;
    disabled?: boolean;
    loading?: boolean;
    error?: string;
    oncadencechange?: (cadence: string) => void;
    onamountchange?: (minor: number) => void;
  }

  let {
    currency = 'GBP',
    presets = [500, 1000, 2500, 5000],
    cadence = $bindable('one-off'),
    selectedAmountMinor = $bindable(1000),
    minAmountMinor,
    maxAmountMinor,
    embedded = false,
    disabled = false,
    loading = false,
    error = '',
    oncadencechange,
    onamountchange,
  }: Props = $props();

  let customAmount = $state('');

  const minimumMinor = $derived(
    minAmountMinor ?? (currency.toLowerCase() === 'gbp' ? 200 : 1),
  );
  const maximumMinor = $derived(
    maxAmountMinor ?? (currency.toLowerCase() === 'gbp' ? 500000 : undefined),
  );
  const amountFactor = $derived(10 ** currencyExponent(currency));
  const visiblePresets = $derived(
    presets.filter(
      (preset) =>
        preset >= minimumMinor && (maximumMinor === undefined || preset <= maximumMinor),
    ),
  );

  const cadenceOptions = $derived([
    { value: 'one-off', label: t('common.oneOff', {}, $locale) },
    { value: 'monthly', label: t('common.monthly', {}, $locale) },
    { value: 'annual', label: t('common.annual', {}, $locale) },
  ]);

  function selectPreset(minor: number) {
    selectedAmountMinor = minor;
    customAmount = '';
    onamountchange?.(minor);
  }

  function selectCustom(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    customAmount = value;
    const major = Number.parseFloat(value);
    if (!Number.isNaN(major)) {
      const lowerBounded = Math.max(minimumMinor, Math.round(major * amountFactor));
      const next =
        maximumMinor === undefined ? lowerBounded : Math.min(maximumMinor, lowerBounded);
      selectedAmountMinor = next;
      onamountchange?.(next);
    }
  }

  const minimumAmountLabel = $derived(
    t(
      'common.minimumCheckout',
      { amount: formatCurrency(minimumMinor, currency, $locale) },
      $locale,
    ),
  );
</script>

<section
  class={stylex.attrs(
    funding.amountSelector,
    embedded ? funding.amountSelectorEmbedded : null,
    loading ? funding.busy : null,
  ).class ?? ''}
  aria-busy={loading}
  aria-label={t('common.supportAmount', {}, $locale)}
>
  {#if embedded}
    <h2 class={stylex.attrs(funding.amountHeading).class ?? ''}>{t('common.supportThisProject', {}, $locale)}</h2>
  {:else}
    <h3 class={stylex.attrs(funding.amountHeading).class ?? ''}>{t('common.supportThisProject', {}, $locale)}</h3>
  {/if}
  <div inert={disabled || loading}>
    <SegmentedControl
      options={cadenceOptions}
      value={cadence}
      label={t('common.cadence', {}, $locale)}
      onchange={(v) => {
        cadence = v;
        oncadencechange?.(v);
      }}
    />
  </div>
  <div
    class={stylex.attrs(funding.presets, disabled || loading ? funding.controlDisabled : null).class ?? ''}
    aria-label={t('common.suggestedAmounts', {}, $locale)}
  >
    {#each visiblePresets as preset (preset)}
      <button
        type="button"
        class={stylex.attrs(
          funding.preset,
          selectedAmountMinor === preset ? funding.presetSelected : null,
          primitives.focusRing,
        ).class ?? ''}
        aria-pressed={selectedAmountMinor === preset}
        aria-label={t('common.chooseAmount', { amount: formatCurrency(preset, currency, $locale) }, $locale)}
        disabled={disabled || loading}
        onclick={() => selectPreset(preset)}
      >
        {formatCurrency(preset, currency, $locale)}
      </button>
    {/each}
  </div>
  <div class={stylex.attrs(funding.customField).class ?? ''} inert={disabled || loading}>
    <TextField
      label={t('common.customAmount', {}, $locale)}
      type="number"
      name="custom-amount"
      placeholder={t('common.enterAmount', {}, $locale)}
      bind:value={customAmount}
      help={minimumAmountLabel}
      {error}
      disabled={disabled || loading}
      oninput={selectCustom}
    />
  </div>
  <p class={stylex.attrs(funding.amountSummary).class ?? ''}>
    {t('common.selected', {}, $locale)}
    {#key `${selectedAmountMinor}:${currency}`}
      <strong class={stylex.attrs(funding.amountSummaryValue).class ?? ''}>{formatCurrency(selectedAmountMinor, currency, $locale)}</strong>
    {/key}
    {#if cadence !== 'one-off'}
      / {formatCadence(cadence, $locale)}
    {/if}
  </p>
  {#if loading}
    <p class={stylex.attrs(funding.feedback).class ?? ''} role="status">{t('common.updatingSupport', {}, $locale)}</p>
  {:else if error}
    <p class={stylex.attrs(funding.feedback).class ?? ''} role="alert">{error}</p>
  {/if}
</section>
