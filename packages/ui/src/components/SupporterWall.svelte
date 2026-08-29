<script lang="ts">
  import type { Supporter } from '../fixtures/demo.js';
  import { formatMoney } from '../fixtures/demo.js';

  interface Props {
    supporters: Supporter[];
    currency?: string;
    showAmounts?: boolean;
  }

  let { supporters, currency = 'GBP', showAmounts = true }: Props = $props();

  const visible = $derived(supporters.filter((s) => s.public));
</script>

<section aria-label="Supporter wall">
  <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">Recent supporters</h3>
  <div class="pl-supporter-wall">
    {#each visible as supporter (supporter.id)}
      <span class="pl-supporter-wall__chip">
        {supporter.displayName}
        {#if showAmounts && supporter.amountMinor}
          <span class="pl-muted"> · {formatMoney(supporter.amountMinor, currency)}</span>
        {/if}
      </span>
    {/each}
  </div>
  {#if visible.length < supporters.length}
    <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 0.75rem;">
      {supporters.length - visible.length} supporters chose private recognition
    </p>
  {/if}
</section>
