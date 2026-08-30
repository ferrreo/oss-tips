<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import type { Tier } from '../fixtures/demo.js';
  import { formatCadence, formatCurrency, locale, t, type MessageKey } from '../lib/i18n.js';
  import { funding } from '../styles/funding.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';

  export interface Props {
    tier: Tier;
    currency?: string;
    cadence?: string;
    selected?: boolean;
    disabled?: boolean;
    loading?: boolean;
    error?: string;
    onclick?: () => void;
  }

  let {
    tier,
    currency = 'GBP',
    cadence = 'monthly',
    selected = false,
    disabled = false,
    loading = false,
    error,
    onclick,
  }: Props = $props();

  const componentId = $props.id();
  const errorId = `${componentId}-tier-error`;

  const priceMinor = $derived(
    cadence === 'annual'
      ? tier.annualMinor
      : cadence === 'one-off'
        ? tier.oneOffMinor
        : tier.monthlyMinor,
  );

  const cadenceLabel = $derived(formatCadence(cadence, $locale).toLowerCase());
  const durationKeys = {
    days_30: 'project.tier.duration.days_30',
    days_90: 'project.tier.duration.days_90',
    year: 'project.tier.duration.year',
    permanent: 'project.tier.duration.permanent',
  } as const satisfies Record<NonNullable<Tier['oneOffDuration']>, MessageKey>;
  const durationLabel = (duration: NonNullable<Tier['oneOffDuration']>) =>
    t(durationKeys[duration], {}, $locale);
</script>

<article
  class={stylex.attrs(
    funding.tierCard,
    selected ? funding.tierCardSelected : null,
    disabled || loading ? funding.tierCardDisabled : null,
    error ? funding.tierCardError : null,
  ).class ?? ''}
  aria-busy={loading}
  aria-describedby={error ? errorId : undefined}
  aria-label={t('common.supportTier', { name: tier.name }, $locale)}
>
  <div class={stylex.attrs(funding.tierTop).class ?? ''}>
    <button
      type="button"
      class={stylex.attrs(
        funding.tierSelect,
        selected ? funding.tierSelectSelected : null,
        disabled || loading ? funding.controlDisabled : null,
        primitives.focusRing,
      ).class ?? ''}
      aria-pressed={selected}
      aria-busy={loading}
      aria-describedby={error ? errorId : undefined}
      disabled={disabled || loading}
      onclick={onclick}
    >
      <strong class={stylex.attrs(funding.tierName).class ?? ''}>{tier.name}</strong>
      <span class={stylex.attrs(funding.tierBadges).class ?? ''}>
      {#if tier.popular}
        <span class={stylex.attrs(funding.tierBadge).class ?? ''}>{t('common.mostPopular', {}, $locale)}</span>
      {/if}
      {#if selected}
        <span class={stylex.attrs(funding.tierCheck).class ?? ''} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              class={stylex.attrs(funding.tierCheckPath).class ?? ''}
              d="M3.2 8.2 L6.4 11.2 L12.8 4.6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      {/if}
      </span>
    </button>
  </div>
  <p class={stylex.attrs(funding.tierDescription).class ?? ''}>{tier.description}</p>
  <div class={stylex.attrs(funding.tierPrice).class ?? ''}>
    {formatCurrency(priceMinor, currency, $locale)}
    {#if cadence !== 'one-off'}
      <span class={stylex.attrs(funding.tierCadence).class ?? ''}>/ {cadenceLabel}</span>
    {/if}
  </div>
  {#if tier.memberLimit}
    <p class={stylex.attrs(funding.tierLimit).class ?? ''}>{t('common.memberLimit', { count: tier.memberLimit }, $locale)}</p>
  {/if}
  {#if cadence === 'one-off' && tier.oneOffDuration}
    <p class={stylex.attrs(funding.tierLimit).class ?? ''}>{durationLabel(tier.oneOffDuration)}</p>
  {/if}
  <ul class={stylex.attrs(funding.tierRewards).class ?? ''}>
    {#each tier.rewards as reward (reward)}
      <li>{reward}</li>
    {/each}
  </ul>
  {#if loading}
    <p class={stylex.attrs(funding.tierError).class ?? ''} role="status">{t('common.updatingTier', {}, $locale)}</p>
  {:else if error}
    <p class={stylex.attrs(funding.tierError).class ?? ''} id={errorId} role="alert">{error}</p>
  {/if}
</article>
