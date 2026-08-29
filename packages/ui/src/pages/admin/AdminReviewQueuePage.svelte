<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import { adminNavGroups } from '../../fixtures/demo.js';
</script>

<AdminShell navGroups={adminNavGroups} title="Review queue">
  <p class="pl-muted" style="margin-bottom: 1rem;">First payment activation, duplicate claims, and risk flags.</p>
  <Table
    columns={[
      { key: 'project', label: 'Project' },
      { key: 'reason', label: 'Reason' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'action', label: '' },
    ]}
    rows={[
      { project: 'ledger-kit', reason: 'Duplicate repository claim', submitted: '2026-08-27', action: 'Review' },
      { project: 'fake-react', reason: 'Impersonation indicator', submitted: '2026-08-26', action: 'Review' },
      { project: 'new-cli-tool', reason: 'First payment activation', submitted: '2026-08-25', action: 'Review' },
    ]}
  />
  <div class="pl-row" style="margin-top: 1rem;">
    <Button variant="primary">Approve selected</Button>
    <Button variant="destructive">Reject with reason</Button>
  </div>
</AdminShell>
