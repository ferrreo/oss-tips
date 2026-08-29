<script lang="ts">
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import { demoPayments, formatMoney } from '../../fixtures/demo.js';
  import { labelCadence, labelPaymentStatus } from '../../lib/labels.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPayments } from './project-demo.js';

  const payments = [...demoPayments, ...extraPayments];
</script>

<ProjectDashShell title="Payments" lede="Charges Stripe has settled or still holds for Grove.">
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    <DataCard label="Settled (30d)" value="$12,841" compare="+18.2%" compareDirection="up" />
    <DataCard label="Pending" value="$20.00" compare="1 guest checkout" />
    <DataCard label="Failed / refunded" value="$40.00" compare="2 events" />
  </div>
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p style="margin: 0; color: var(--pl-ink);">{payments.length} charges in this view.</p>
    <Button variant="secondary">Export CSV</Button>
  </div>
  <Table
    caption="Recent Grove payments"
    columns={[
      { key: 'date', label: 'Date' },
      { key: 'supporter', label: 'Supporter' },
      { key: 'amount', label: 'Amount' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'status', label: 'Status' },
    ]}
    rows={payments.map((payment) => ({
      date: payment.date,
      supporter: payment.supporter,
      amount: formatMoney(payment.amountMinor, payment.currency),
      cadence: labelCadence(payment.cadence),
      status: labelPaymentStatus(payment.status),
    }))}
  />
</ProjectDashShell>
