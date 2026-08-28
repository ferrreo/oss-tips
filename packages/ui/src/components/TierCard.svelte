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

  const priceMinor =
    cadence === 'annual' ? tier.annualMinor : cadence === 'one-off' ? tier.oneOffMinor : tier.monthlyMinor;
</script>

<button
  type="button"
  class="pl-tier-card pl-focus-ring {selected ? 'pl-tier-card--selected' : ''}"
  aria-pressed={selected}
  onclick={onclick}
>
  <div class="pl-row pl-row--between" style="margin-bottom: 0.5rem;">
    <strong>{tier.name}</strong>
    {#if tier.popular}
      <span class="pl-badge pl-badge--ochre">Popular</span>
    {/if}
    {#if selected}
      <span class="pl-badge pl-badge--forest" aria-label="Selected">✓</span>
    {/if}
  </div>
  <p class="pl-muted" style="font-size: 0.875rem; margin: 0 0 0.75rem;">{tier.description}</p>
  <div class="pl-tier-card__price">
    {formatMoney(priceMinor, currency)}
    {#if cadence !== 'one-off'}
      <span class="pl-muted" style="font-size: 0.875rem;">/ {cadence}</span>
    {/if}
  </div>
  {#if tier.memberLimit}
    <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 0.5rem;">
      {tier.memberLimit} member limit
    </p>
  {/if}
  <ul style="margin: 0.75rem 0 0; padding-left: 1.125rem; font-size: 0.875rem; color: var(--pl-ink-muted);">
    {#each tier.rewards as reward (reward)}
      <li>{reward}</li>
    {/each}
  </ul>
</button>
