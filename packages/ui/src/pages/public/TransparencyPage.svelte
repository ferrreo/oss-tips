<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';

  const pageDemo = {
    cards: [
      { label: 'Projects published', value: '1,248', compare: '+12 this month', compareDirection: 'up' as const, sparkline: [980, 1040, 1112, 1180, 1220, 1248] },
      { label: 'Support processed (30d)', value: '$2.4M', compare: 'Settled volume', compareDirection: 'neutral' as const, sparkline: [18, 19, 21, 20, 23, 24] },
      { label: 'Median project fee', value: '5.0%', compare: 'Standard mode', compareDirection: 'neutral' as const, sparkline: [5, 5, 5, 5, 5, 5] },
      { label: 'Guest one-off share', value: '38%', compare: 'Of settled one-offs', compareDirection: 'neutral' as const, sparkline: [34, 35, 36, 37, 37, 38] },
      { label: 'Refunded (30d)', value: '0.4%', compare: 'Of settled volume', compareDirection: 'neutral' as const, sparkline: [6, 5, 5, 4, 4, 4] },
      { label: 'Active memberships', value: '6,412', compare: 'Renewing next 30d: 811', compareDirection: 'neutral' as const, sparkline: [5200, 5480, 5710, 5980, 6210, 6412] },
    ],
    columns: [
      { key: 'rule', label: 'Rule' },
      { key: 'detail', label: 'How we apply it' },
    ],
    rows: [
      { rule: 'Settlement only', detail: 'Figures update after Stripe settlement, not authorisation.' },
      { rule: 'No vanity rank', detail: 'We do not publish payment-volume leaderboards.' },
      { rule: 'Tips excluded', detail: 'Supporter tips to oss.tips are not counted as project support.' },
      { rule: 'Refunds subtracted', detail: 'Chargebacks and refunds reduce the settled totals.' },
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Transparency</h1>
      <p class="pl-page-lead">Platform counters derived from settled data only.</p>
      <div class="tr-grid">
        {#each pageDemo.cards as card (card.label)}
          <DataCard
            label={card.label}
            value={card.value}
            compare={card.compare}
            compareDirection={card.compareDirection}
            sparkline={card.sparkline}
          />
        {/each}
      </div>
      <div class="pl-prose" style="margin-top: 2rem;">
        <h2>How we report</h2>
        <p>Figures update after Stripe settlement. We do not show vanity metrics or payment-volume leaderboards.</p>
      </div>
      <Table columns={pageDemo.columns} rows={pageDemo.rows} caption="Reporting rules" />
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .tr-grid {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
  }

  @media (min-width: 44rem) {
    .tr-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
