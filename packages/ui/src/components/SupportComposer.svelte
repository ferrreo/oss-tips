<script lang="ts">
  import AmountSelector from './AmountSelector.svelte';
  import FeeDisclosure from './FeeDisclosure.svelte';
  import Button from './Button.svelte';
  import type { Tier } from '../fixtures/demo.js';
  import { formatMoney } from '../fixtures/demo.js';

  interface Props {
    tiers?: Tier[];
    currency?: string;
    projectFeePercent?: number;
  }

  let { tiers = [], currency = 'GBP', projectFeePercent = 5 }: Props = $props();

  let cadence = $state('one-off');
  let amountMinor = $state(1000);
  let tipMinor = $state(0);
  let selectedTierId = $state<string | null>(null);

  const selectedTier = $derived(tiers.find((tier) => tier.id === selectedTierId));

  function priceFor(tier: Tier, nextCadence = cadence): number {
    if (nextCadence === 'annual') return tier.annualMinor;
    if (nextCadence === 'one-off') return tier.oneOffMinor;
    return tier.monthlyMinor;
  }

  function selectTier(tier: Tier) {
    selectedTierId = tier.id;
    amountMinor = priceFor(tier);
  }

  function onCadenceChange(next: string) {
    cadence = next;
    if (selectedTier) amountMinor = priceFor(selectedTier, next);
  }

  function onAmountChange(next: number) {
    amountMinor = next;
    const match = tiers.find((tier) => priceFor(tier) === next);
    selectedTierId = match?.id ?? null;
  }

  const tipPresets = [0, 100, 200];
</script>

<section class="pl-composer-panel">
  {#if tiers.length > 0}
    <div class="pl-composer__tier-row" role="list">
      {#each tiers as tier (tier.id)}
        <button
          type="button"
          class="pl-composer__tier pl-focus-ring {selectedTierId === tier.id ? 'pl-composer__tier--selected' : ''}"
          aria-pressed={selectedTierId === tier.id}
          onclick={() => selectTier(tier)}
        >
          <span class="pl-composer__tier-name">{tier.name}</span>
          <span class="pl-composer__tier-price">{formatMoney(priceFor(tier), currency)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <AmountSelector
    {currency}
    {cadence}
    selectedAmountMinor={amountMinor}
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

  <div class="pl-field">
    <label class="pl-field__label" for="oss-tips-tip">Optional oss.tips tip</label>
    <span class="pl-field__help">Supports platform operations. Editable to zero.</span>
    <div class="pl-composer__tip-presets">
      {#each tipPresets as preset (preset)}
        <button
          type="button"
          class="pl-composer__preset pl-focus-ring {tipMinor === preset ? 'pl-composer__preset--selected' : ''}"
          onclick={() => (tipMinor = preset)}
        >
          {formatMoney(preset, currency)}
        </button>
      {/each}
    </div>
    <input
      id="oss-tips-tip"
      class="pl-input pl-focus-ring"
      type="number"
      min="0"
      step="0.5"
      value={tipMinor / 100}
      oninput={(e) => (tipMinor = Math.round(parseFloat(e.currentTarget.value || '0') * 100))}
    />
  </div>

  <Button variant="primary" type="button" class="pl-composer__submit">Continue to checkout</Button>
</section>
