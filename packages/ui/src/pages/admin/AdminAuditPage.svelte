<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { adminNavGroups } from '../../fixtures/demo.js';

  let filter = $state('');
</script>

<AdminShell navGroups={adminNavGroups} title="Audit log">
  <TextField label="Filter by actor or action" value={filter} type="search" placeholder="e.g. admin.refund.create" />
  <Table
    columns={[
      { key: 'time', label: 'Time' },
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'target', label: 'Target' },
    ]}
    rows={[
      { time: '2026-08-27T15:02Z', actor: 'ops@oss.tips', action: 'project.review.approve', target: 'new-cli-tool' },
      { time: '2026-08-27T14:30Z', actor: 'finance@oss.tips', action: 'refund.exceptional', target: 'pay_abc123' },
      { time: '2026-08-27T11:15Z', actor: 'ops@oss.tips', action: 'project.restrict.payments', target: 'fake-react' },
    ]}
    style="margin-top: 1rem;"
  />
  <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 1rem;">Immutable append-only log. Retention: 7 years.</p>
</AdminShell>
