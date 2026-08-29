<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import SupporterAccountNav from './SupporterAccountNav.svelte';
  import { labelCadence, labelMembershipStatus } from '../../lib/labels.js';
  import {
    formatMoney,
    monthlyActiveMinor,
    platformTipMinor,
    supporterMemberships,
  } from './supporter-demo.js';

  const active = supporterMemberships.filter((m) => m.status === 'active');
  const pastDue = supporterMemberships.filter((m) => m.status === 'past_due');
  const cancelled = supporterMemberships.filter((m) => m.status === 'cancelled');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <div class="pl-row pl-row--between" style="margin-bottom: 0.25rem; flex-wrap: wrap;">
        <h1 class="pl-page-title">Memberships</h1>
        <Button variant="secondary">Manage platform tip</Button>
      </div>
      <p class="pl-page-lead">Recurring support you control. Downgrades apply at the next renewal.</p>
      <SupporterAccountNav current="memberships" />

      <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
        <DataCard label="Active" value={String(active.length)} compare="{formatMoney(monthlyActiveMinor)} / month equivalent" />
        <DataCard label="Past due" value={String(pastDue.length)} compare="Grace period still open" compareDirection="down" />
        <DataCard
          label="oss.tips tip"
          value={`${formatMoney(platformTipMinor)} / month`}
          compare="Separate from project tiers"
        />
      </div>

      <Table
        caption="All memberships on this account, including cancelled periods that have not yet ended."
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier' },
          { key: 'cadence', label: 'Cadence' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status' },
          { key: 'renews', label: 'Renews / ends' },
        ]}
        rows={supporterMemberships.map((m) => ({
          project: m.projectName,
          tier: m.tierName,
          cadence: labelCadence(m.cadence),
          amount: formatMoney(m.amountMinor, m.currency),
          status: labelMembershipStatus(m.status),
          renews: m.renewsAt ?? 'Ended 2026-08-01',
        }))}
      />

      <section class="pl-surface" style="margin-top: 1.5rem; padding: 1.25rem;">
        <h2 style="font-size: 1.125rem; margin-bottom: 0.5rem;">Platform tip</h2>
        <p style="margin: 0 0 0.75rem;">
          {formatMoney(platformTipMinor)} recurs with your oldest active membership. Projects cannot see or change this
          amount.
        </p>
        <div class="pl-row" style="flex-wrap: wrap;">
          <Badge variant="forest">£1.00 / month</Badge>
          <Button variant="quiet">Change tip</Button>
          <Button variant="quiet">Remove tip</Button>
        </div>
      </section>

      {#each pastDue as membership (membership.id)}
        <p class="pl-muted" style="font-size: 0.875rem; margin-top: 1rem;">
          {membership.projectName} is past due. Access and mapped Discord roles remain during the seven-day grace.
        </p>
      {/each}
      {#each cancelled as membership (membership.id)}
        <p class="pl-muted" style="font-size: 0.875rem; margin-top: 0.5rem;">
          {membership.projectName} is cancelled. Entitlements ran to the paid-period end.
        </p>
      {/each}
    </div>
  </main>
</div>
