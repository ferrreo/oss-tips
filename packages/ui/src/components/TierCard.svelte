<script lang="ts">
  import type { Tier } from '../fixtures/demo.js';
  import { formatMoney } from '../fixtures/demo.js';

  interface Props {
    tier: Tier;
    currency?: string;
    cadence?: string;
    selected?: boolean;
    onclick?: () => void;
  }

  let { tier, currency = 'GBP', cadence = 'monthly', selected = false, onclick }: Props = $props();

  const priceMinor = $derived(
    cadence === 'annual' ? tier.annualMinor : cadence === 'one-off' ? tier.oneOffMinor : tier.monthlyMinor,
  );

  const cadenceLabel = $derived(cadence === 'one-off' ? 'one-off' : cadence);
</script>

<button
  type="button"
  class="pl-tier-card pl-focus-ring {selected ? 'pl-tier-card--selected' : ''}"
  aria-pressed={selected}
  onclick={onclick}
>
  <div class="pl-tier-card__top">
    <strong class="pl-tier-card__name">{tier.name}</strong>
    <div class="pl-tier-card__badges">
      {#if tier.popular}
        <span class="pl-badge pl-badge--ochre">Most popular</span>
      {/if}
      {#if selected}
        <span class="pl-tier-card__check" aria-label="Selected">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              class="pl-tier-card__check-path"
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
    </div>
  </div>
  <p class="pl-tier-card__desc">{tier.description}</p>
  <div class="pl-tier-card__price">
    {formatMoney(priceMinor, currency)}
    {#if cadence !== 'one-off'}
      <span class="pl-tier-card__cadence">/ {cadenceLabel}</span>
    {/if}
  </div>
  {#if tier.memberLimit}
    <p class="pl-tier-card__limit">{tier.memberLimit} member limit</p>
  {/if}
  <ul class="pl-tier-card__rewards">
    {#each tier.rewards as reward (reward)}
      <li>{reward}</li>
    {/each}
  </ul>
</button>
