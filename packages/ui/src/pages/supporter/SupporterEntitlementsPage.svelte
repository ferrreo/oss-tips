<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Table from '../../components/Table.svelte';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import SupporterAccountNav from './SupporterAccountNav.svelte';
  import { supporterEntitlements } from './supporter-demo.js';

  const today = '2026-08-29';

  function statusOf(e: (typeof supporterEntitlements)[number]): 'permanent' | 'active' | 'expired' {
    if (e.permanent) return 'permanent';
    if (e.expiresAt && e.expiresAt < today) return 'expired';
    return 'active';
  }

  const permanent = supporterEntitlements.filter((e) => statusOf(e) === 'permanent');
  const active = supporterEntitlements.filter((e) => statusOf(e) === 'active');
  const expired = supporterEntitlements.filter((e) => statusOf(e) === 'expired');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Entitlements</h1>
      <p class="pl-page-lead">Rewards from one-off and recurring support. Duration was shown before you paid.</p>
      <SupporterAccountNav current="entitlements" />

      <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
        <DataCard label="Active" value={String(active.length)} compare="Renew with the membership" />
        <DataCard label="Permanent" value={String(permanent.length)} compare="One-off gifts that do not expire" />
        <DataCard label="Expired" value={String(expired.length)} compare="Kept for your records" />
      </div>

      <Table
        caption="Higher-tier payments do not automatically absorb a lower-tier one-off."
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier / reward' },
          { key: 'expires', label: 'Expires' },
          { key: 'status', label: 'Status' },
          { key: 'source', label: 'Source' },
        ]}
        rows={supporterEntitlements.map((e) => ({
          project: e.projectName,
          tier: e.tierName,
          expires: e.permanent ? 'Permanent' : (e.expiresAt ?? '—'),
          status: statusOf(e),
          source: e.permanent ? 'One-off' : 'Membership',
        }))}
      />

      <div class="pl-row" style="margin-top: 1rem; flex-wrap: wrap;">
        <Badge variant="forest">{active.length} active</Badge>
        <Badge>{permanent.length} permanent</Badge>
        <Badge variant="ochre">{expired.length} expired</Badge>
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
