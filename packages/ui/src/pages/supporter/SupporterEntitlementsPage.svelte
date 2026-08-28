<script lang="ts">
  import PublicNav from '../components/PublicNav.svelte';
  import Table from '../components/Table.svelte';
  import Badge from '../components/Badge.svelte';
  import { demoEntitlements } from '../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Entitlements</h1>
      <p class="pl-page-lead">Rewards from one-off and recurring support across projects.</p>
      <Table
        columns={[
          { key: 'project', label: 'Project' },
          { key: 'tier', label: 'Tier / reward' },
          { key: 'expires', label: 'Expires' },
          { key: 'status', label: 'Status' },
        ]}
        rows={demoEntitlements.map((e) => ({
          project: e.projectName,
          tier: e.tierName,
          expires: e.permanent ? 'Permanent' : e.expiresAt ?? '—',
          status: e.permanent ? 'permanent' : 'active',
        }))}
      />
    </div>
  </main>
</div>
