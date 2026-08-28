<script lang="ts">
  import PublicNav from '../components/PublicNav.svelte';
  import DataCard from '../components/DataCard.svelte';
  import Table from '../components/Table.svelte';
  import { demoMemberships, formatMoney } from '../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Your support</h1>
      <p class="pl-page-lead">Memberships, entitlements, and inbox at a glance.</p>
      <div class="pl-grid-3" style="margin: 1.5rem 0;">
        <DataCard label="Active memberships" value="2" />
        <DataCard label="Monthly total" value={formatMoney(2200)} compare="Across projects" />
        <DataCard label="Unread messages" value="1" compareDirection="up" />
      </div>
      <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">Memberships</h2>
      <Table
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier' },
          { key: 'amount', label: 'Amount' },
          { key: 'renews', label: 'Renews' },
        ]}
        rows={demoMemberships.map((m) => ({
          project: m.projectName,
          tier: m.tierName,
          amount: formatMoney(m.amountMinor, m.currency) + '/' + m.cadence,
          renews: m.renewsAt ?? '—',
        }))}
      />
    </div>
  </main>
</div>
