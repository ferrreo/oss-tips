<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../styles/stylex-runtime.js';
  import AmountSelector from './AmountSelector.svelte';
  import FeeDisclosure from './FeeDisclosure.svelte';
  import Button from './Button.svelte';
  import TextField from './TextField.svelte';
  import type { Tier } from '../fixtures/demo.js';
  import { formatCurrency, locale, t, type MessageKey } from '../lib/i18n.js';
  import { currencyExponent } from '@oss-tips/domain/money';
  import { funding } from '../styles/funding.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';

  export type SupportCadence = 'one-off' | 'monthly' | 'annual';

  export interface SupportCheckoutRequest {
    tierId?: string;
    projectAmountMinor: number;
    projectCurrency: string;
    platformTipMinor: number;
    cadence: 'one_off' | 'monthly' | 'annual';
    publicOptions: {
      showName: boolean;
      showAmount: boolean;
      showMessage: boolean;
      displayName?: string;
      message?: string;
    };
    receiptEmail?: string;
  }

  export interface Props {
    tiers?: Tier[];
    currency?: string;
    projectFeePercent?: number;
    disabled?: boolean;
    loading?: boolean;
    error?: string;
    initialCadence?: SupportCadence;
    initialAmountMinor?: number;
    initialTipMinor?: number;
    initialDisplayName?: string;
    initialMessage?: string;
    initialReceiptEmail?: string;
    initialShowName?: boolean;
    initialShowAmount?: boolean;
    initialShowMessage?: boolean;
    selectedTierId?: string | null;
    minAmountMinor?: number;
    maxAmountMinor?: number;
    oncontinue?: ((request: SupportCheckoutRequest) => void | Promise<void>) | undefined;
  }

  let {
    tiers = [],
    currency = 'GBP',
    projectFeePercent = 5,
    disabled = false,
    loading = false,
    error = '',
    initialCadence = 'one-off',
    initialAmountMinor = 1000,
    initialTipMinor = 0,
    initialDisplayName = '',
    initialMessage = '',
    initialReceiptEmail = '',
    initialShowName = false,
    initialShowAmount = false,
    initialShowMessage = false,
    selectedTierId = $bindable(null),
    minAmountMinor,
    maxAmountMinor,
    oncontinue,
  }: Props = $props();

  const componentId = $props.id();
  const tipId = `${componentId}-tip`;
  const tipHelpId = `${componentId}-tip-help`;

  let cadence = $state<SupportCadence>(untrack(() => initialCadence));
  let amountMinor = $state(untrack(() => initialAmountMinor));
  let tipMinor = $state(untrack(() => initialTipMinor));
  let displayName = $state(untrack(() => initialDisplayName));
  let message = $state(untrack(() => initialMessage));
  let receiptEmail = $state(untrack(() => initialReceiptEmail));
  let showName = $state(untrack(() => initialShowName));
  let showAmount = $state(untrack(() => initialShowAmount));
  let showMessage = $state(untrack(() => initialShowMessage));
  const selectedTier = $derived(tiers.find((tier) => tier.id === selectedTierId));
  let pricedTierId = $state<string | null>(null);

  function priceFor(tier: Tier, nextCadence = cadence): number {
    if (nextCadence === 'annual') return tier.annualMinor;
    if (nextCadence === 'one-off') return tier.oneOffMinor;
    return tier.monthlyMinor;
  }

  $effect(() => {
    if (selectedTierId === pricedTierId) return;
    pricedTierId = selectedTierId;
    if (selectedTier) amountMinor = priceFor(selectedTier);
  });

  function selectTier(tier: Tier) {
    if (disabled || loading) return;
    selectedTierId = tier.id;
    amountMinor = priceFor(tier);
  }

  function onCadenceChange(next: string) {
    if (disabled || loading) return;
    if (next !== 'one-off' && next !== 'monthly' && next !== 'annual') return;
    cadence = next;
    if (selectedTier) amountMinor = priceFor(selectedTier, next);
  }

  function onAmountChange(next: number) {
    if (disabled || loading) return;
    amountMinor = next;
    const match = tiers.find((tier) => priceFor(tier) === next);
    selectedTierId = match?.id ?? null;
  }

  async function continueToCheckout() {
    if (disabled || loading || !oncontinue) return;
    await oncontinue({
      ...(selectedTierId ? { tierId: selectedTierId } : {}),
      projectAmountMinor: amountMinor,
      projectCurrency: currency.toLowerCase(),
      platformTipMinor: tipMinor,
      cadence: cadence === 'one-off' ? 'one_off' : cadence,
      publicOptions: {
        showName,
        showAmount,
        showMessage,
        ...(showName && displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(showMessage && message.trim() ? { message: message.trim() } : {}),
      },
      ...(receiptEmail.trim() ? { receiptEmail: receiptEmail.trim() } : {}),
    });
  }

  const tipPresets = [0, 100, 200];
  const exponent = $derived(currencyExponent(currency));
  const tipFactor = $derived(10 ** exponent);
  const tipStep = $derived(exponent === 0 ? 1 : 0.5);
  const durationKeys = {
    days_30: 'project.tier.duration.days_30',
    days_90: 'project.tier.duration.days_90',
    year: 'project.tier.duration.year',
    permanent: 'project.tier.duration.permanent',
  } as const satisfies Record<NonNullable<Tier['oneOffDuration']>, MessageKey>;
  const durationLabel = (duration: NonNullable<Tier['oneOffDuration']>) =>
    t(durationKeys[duration], {}, $locale);
</script>

<section
  class={stylex.attrs(funding.composer, loading ? funding.busy : null).class ?? ''}
  aria-busy={loading}
  aria-label={t('common.supportThisProject', {}, $locale)}
>
  {#if tiers.length > 0}
    <div class={stylex.attrs(funding.composerTierRow).class ?? ''} role="group" aria-label={t('common.supportTiers', {}, $locale)}>
      {#each tiers as tier (tier.id)}
        <button
          type="button"
          class={stylex.attrs(
            funding.composerTier,
            selectedTierId === tier.id ? funding.composerTierSelected : null,
            disabled || loading ? funding.controlDisabled : null,
            primitives.focusRing,
          ).class ?? ''}
          aria-pressed={selectedTierId === tier.id}
          aria-label={t('common.tierAmount', { name: tier.name, amount: formatCurrency(priceFor(tier), currency, $locale) }, $locale)}
          disabled={disabled || loading}
          onclick={() => selectTier(tier)}
        >
          <span class={stylex.attrs(funding.composerTierName).class ?? ''}>{tier.name}</span>
          <span class={stylex.attrs(funding.composerTierPrice).class ?? ''}>{formatCurrency(priceFor(tier), currency, $locale)}</span>
          {#if cadence === 'one-off' && tier.oneOffDuration}
            <span class={stylex.attrs(funding.tierCadence).class ?? ''}>{durationLabel(tier.oneOffDuration)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <AmountSelector
    {currency}
    {cadence}
    selectedAmountMinor={amountMinor}
    {...(minAmountMinor === undefined ? {} : { minAmountMinor })}
    {...(maxAmountMinor === undefined ? {} : { maxAmountMinor })}
    embedded
    {disabled}
    {loading}
    {error}
    oncadencechange={onCadenceChange}
    onamountchange={onAmountChange}
  />

  <FeeDisclosure
    projectAmountMinor={amountMinor}
    {projectFeePercent}
    {tipMinor}
    {currency}
    {cadence}
  />

  <div class={stylex.attrs(funding.recognition).class ?? ''}>
    <h3 class={stylex.attrs(funding.recognitionHeading).class ?? ''}>{t('public.support.recognition', {}, $locale)}</h3>
    <div class={stylex.attrs(funding.recognitionFields).class ?? ''}>
      <TextField
        label={t('public.support.displayName', {}, $locale)}
        name="support-display-name"
        autocomplete="name"
        placeholder={t('public.support.displayNamePlaceholder', {}, $locale)}
        bind:value={displayName}
        disabled={disabled || loading}
      />
      <TextField
        label={t('public.support.receiptEmail', {}, $locale)}
        name="support-receipt-email"
        type="email"
        autocomplete="email"
        help={t('public.support.receiptEmailHelp', {}, $locale)}
        bind:value={receiptEmail}
        disabled={disabled || loading}
      />
    </div>
    <label class={stylex.attrs(funding.tipLabel).class ?? ''} for={`${componentId}-message`}>
      {t('public.support.message', {}, $locale)}
    </label>
    <textarea
      id={`${componentId}-message`}
      class={stylex.attrs(funding.recognitionMessage, primitives.focusRing).class ?? ''}
      name="support-public-message"
      maxlength="2000"
      placeholder={t('public.support.messagePlaceholder', {}, $locale)}
      bind:value={message}
      disabled={disabled || loading}
    ></textarea>
    <div class={stylex.attrs(funding.recognitionChecks).class ?? ''}>
      <label class={stylex.attrs(funding.recognitionCheck).class ?? ''}>
        <input class={stylex.attrs(funding.recognitionCheckbox, primitives.focusRing).class ?? ''} type="checkbox" bind:checked={showName} disabled={disabled || loading} />
        {t('public.support.showName', {}, $locale)}
      </label>
      <label class={stylex.attrs(funding.recognitionCheck).class ?? ''}>
        <input class={stylex.attrs(funding.recognitionCheckbox, primitives.focusRing).class ?? ''} type="checkbox" bind:checked={showAmount} disabled={disabled || loading} />
        {t('public.support.showAmount', {}, $locale)}
      </label>
      <label class={stylex.attrs(funding.recognitionCheck).class ?? ''}>
        <input class={stylex.attrs(funding.recognitionCheckbox, primitives.focusRing).class ?? ''} type="checkbox" bind:checked={showMessage} disabled={disabled || loading} />
        {t('public.support.showMessage', {}, $locale)}
      </label>
    </div>
  </div>

  <div class={stylex.attrs(funding.tipField).class ?? ''}>
    <label class={stylex.attrs(funding.tipLabel).class ?? ''} for={tipId}>{t('common.optionalTip', {}, $locale)}</label>
    <span class={stylex.attrs(funding.tipHelp).class ?? ''} id={tipHelpId}>{t('common.tipDescription', {}, $locale)}</span>
    <div class={stylex.attrs(funding.tipPresets).class ?? ''}>
      {#each tipPresets as preset (preset)}
        <button
          type="button"
          class={stylex.attrs(
            funding.preset,
            tipMinor === preset ? funding.presetSelected : null,
            disabled || loading ? funding.controlDisabled : null,
            primitives.focusRing,
          ).class ?? ''}
          aria-pressed={tipMinor === preset}
          aria-label={t('common.setTip', { amount: formatCurrency(preset, currency, $locale) }, $locale)}
          disabled={disabled || loading}
          onclick={() => (tipMinor = preset)}
        >
          {formatCurrency(preset, currency, $locale)}
        </button>
      {/each}
    </div>
    <input
      id={tipId}
      class={stylex.attrs(funding.tipInput, disabled || loading ? funding.controlDisabled : null, primitives.focusRing).class ?? ''}
      type="number"
      name="oss-tips-tip"
      min="0"
      step={tipStep}
      value={tipMinor / tipFactor}
      aria-describedby={tipHelpId}
      disabled={disabled || loading}
      oninput={(e) => (tipMinor = Math.max(0, Math.round(Number.parseFloat(e.currentTarget.value || '0') * tipFactor)))}
    />
  </div>

  {#if error}
    <p class={stylex.attrs(funding.feedback).class ?? ''} role="alert">{error}</p>
  {/if}
  <Button
    variant="primary"
    type="button"
    label={t('common.continueCheckout', {}, $locale)}
    loading={loading}
    disabled={disabled}
    onclick={continueToCheckout}
    class={stylex.attrs(funding.composerSubmit).class ?? ''}
  />
</section>
