<script lang="ts">
  import PublicNav from '../components/PublicNav.svelte';
  import Table from '../components/Table.svelte';
  import Button from '../components/Button.svelte';
  import Badge from '../components/Badge.svelte';
  import { demoMemberships, formatMoney } from '../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
        <h1 class="pl-page-title">Memberships</h1>
        <Button variant="secondary">Manage platform tip</Button>
      </div>
      <Table
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier' },
          { key: 'cadence', label: 'Cadence' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status' },
        ]}
        rows={demoMemberships.map((m) => ({
          project: m.projectName,
          tier: m.tierName,
          cadence: m.cadence,
          amount: formatMoney(m.amountMinor, m.currency),
          status: m.status,
        }))}
      />
      <p class="pl-muted" style="font-size: 0.875rem; margin-top: 1rem;">
        Downgrades apply at next renewal. Your oss.tips tip is separate from project tiers.
      </p>
    </div>
  </main>
</div>
