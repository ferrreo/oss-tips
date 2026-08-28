<script lang="ts">
  import AmountSelector from './AmountSelector.svelte';
  import FeeDisclosure from './FeeDisclosure.svelte';
  import Button from './Button.svelte';
  import type { Tier } from '../fixtures/demo.js';

  interface Props {
    tiers?: Tier[];
    currency?: string;
    projectFeePercent?: number;
  }

  let { tiers = [], currency = 'GBP', projectFeePercent = 5 }: Props = $props();

  let cadence = $state('one-off');
  let amountMinor = $state(1000);
  let tipMinor = $state(0);
</script>

<div class="pl-stack">
  <AmountSelector
    currency={currency}
    cadence={cadence}
    selectedAmountMinor={amountMinor}
    oncadencechange={(v) => (cadence = v)}
    onamountchange={(v) => (amountMinor = v)}
  />
  <FeeDisclosure
    projectAmountMinor={amountMinor}
    projectFeePercent={projectFeePercent}
    tipMinor={tipMinor}
    currency={currency}
    cadence={cadence}
  />
  <div class="pl-field">
    <label class="pl-field__label" for="tip">Optional oss.tips tip</label>
    <span class="pl-field__help">Supports platform operations. Editable to zero.</span>
    <input
      id="tip"
      class="pl-input pl-focus-ring"
      type="number"
      min="0"
      step="0.5"
      value={tipMinor / 100}
      oninput={(e) => (tipMinor = Math.round(parseFloat((e.currentTarget as HTMLInputElement).value || '0') * 100))}
    />
  </div>
  <Button variant="primary" type="button">Continue to checkout</Button>
</div>
