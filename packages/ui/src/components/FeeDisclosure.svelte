<script lang="ts">
  import { formatMoney } from '../fixtures/demo.js';

  interface Props {
    projectAmountMinor: number;
    projectFeePercent?: number;
    tipMinor?: number;
    currency?: string;
    cadence?: string;
  }

  let {
    projectAmountMinor,
    projectFeePercent = 5,
    tipMinor = 0,
    currency = 'GBP',
    cadence = 'one-off',
  }: Props = $props();

  const projectFeeMinor = $derived(Math.round(projectAmountMinor * (projectFeePercent / 100)));
  const totalMinor = $derived(projectAmountMinor + projectFeeMinor + tipMinor);
</script>

<div class="pl-fee-disclosure" aria-label="Fee breakdown">
  <strong style="display: block; margin-bottom: 0.5rem;">Before you confirm</strong>
  <div class="pl-fee-disclosure__row">
    <span>Project receives</span>
    <span>{formatMoney(projectAmountMinor, currency)}</span>
  </div>
  <div class="pl-fee-disclosure__row">
    <span>oss.tips project fee ({projectFeePercent}%)</span>
    <span>{formatMoney(projectFeeMinor, currency)}</span>
  </div>
  {#if tipMinor > 0}
    <div class="pl-fee-disclosure__row">
      <span>Your oss.tips tip</span>
      <span>{formatMoney(tipMinor, currency)}</span>
    </div>
  {/if}
  <div class="pl-fee-disclosure__row pl-muted" style="font-size: 0.8125rem;">
    <span>Cadence</span>
    <span>{cadence}</span>
  </div>
  <div class="pl-fee-disclosure__row pl-fee-disclosure__total">
    <span>You pay today</span>
    <span>{formatMoney(totalMinor, currency)}</span>
  </div>
  <p class="pl-muted" style="font-size: 0.75rem; margin: 0.75rem 0 0;">
    Payment method and localised pricing shown in Stripe Checkout. The project is the merchant of record.
  </p>
</div>
