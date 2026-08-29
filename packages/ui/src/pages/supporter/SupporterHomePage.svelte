<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import Table from '../../components/Table.svelte';
  import Badge from '../../components/Badge.svelte';
  import SupporterAccountNav from './SupporterAccountNav.svelte';
  import {
    formatMoney,
    lifetimeSupport,
    lifetimeTotalMinor,
    monthlyActiveMinor,
    supporterEntitlements,
    supporterMemberships,
    supporterName,
    unreadThreadCount,
  } from './supporter-demo.js';

  const activeMemberships = supporterMemberships.filter((m) => m.status === 'active');
  const liveEntitlements = supporterEntitlements.filter((e) => e.permanent || (e.expiresAt && e.expiresAt >= '2026-08-29'));
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Your support</h1>
      <p class="pl-page-lead">
        {supporterName} — memberships, entitlements, and lifetime support across projects.
      </p>
      <SupporterAccountNav current="home" />

      <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
        <DataCard
          label="Lifetime support"
          value={formatMoney(lifetimeTotalMinor)}
          compare="Across {lifetimeSupport.length} projects"
        />
        <DataCard
          label="Active memberships"
          value={String(activeMemberships.length)}
          compare="{formatMoney(monthlyActiveMinor)} / month equivalent"
        />
        <DataCard
          label="Unread messages"
          value={String(unreadThreadCount)}
          compare="From projects you support"
          compareDirection="up"
        />
      </div>

      <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">Memberships</h2>
      <Table
        caption="Recurring memberships, including past-due and cancelled."
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status' },
          { key: 'renews', label: 'Renews' },
        ]}
        rows={supporterMemberships.map((m) => ({
          project: m.projectName,
          tier: m.tierName,
          amount: `${formatMoney(m.amountMinor, m.currency)}/${m.cadence}`,
          status: m.status,
          renews: m.renewsAt ?? '—',
        }))}
      />

      <h2 style="font-size: 1.125rem; margin: 2rem 0 0.75rem;">Entitlements</h2>
      <Table
        caption="{liveEntitlements.length} currently grant access. Expired rows stay visible for history."
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier / reward' },
          { key: 'expires', label: 'Expires' },
          { key: 'status', label: 'Status' },
        ]}
        rows={supporterEntitlements.map((e) => {
          const expired = !e.permanent && e.expiresAt && e.expiresAt < '2026-08-29';
          return {
            project: e.projectName,
            tier: e.tierName,
            expires: e.permanent ? 'Permanent' : (e.expiresAt ?? '—'),
            status: e.permanent ? 'permanent' : expired ? 'expired' : 'active',
          };
        })}
      />

      <h2 style="font-size: 1.125rem; margin: 2rem 0 0.75rem;">Lifetime support by project</h2>
      <Table
        caption="One-off gifts plus settled recurring charges. Supporter tips to oss.tips are not included."
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'oneOff', label: 'One-off' },
          { key: 'recurring', label: 'Recurring' },
          { key: 'total', label: 'Lifetime' },
        ]}
        rows={lifetimeSupport.map((row) => ({
          project: row.projectName,
          oneOff: formatMoney(row.oneOffMinor, row.currency),
          recurring: formatMoney(row.recurringMinor, row.currency),
          total: formatMoney(row.oneOffMinor + row.recurringMinor, row.currency),
        }))}
      />

      <p class="pl-muted" style="font-size: 0.875rem; margin-top: 1rem;">
        <Badge>Past-due</Badge>
        ledger-kit is in the seven-day grace period. Entitlements stay until the grace ends.
      </p>
    </div>
  </main>
</div>
