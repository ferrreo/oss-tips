<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import { adminNavGroups } from '../../fixtures/demo.js';
</script>

<AdminShell navGroups={adminNavGroups} title="Cases">
  <p class="pl-muted" style="margin-bottom: 1rem;">Abuse, recovery, and payment restriction cases.</p>
  <Table
    columns={[
      { key: 'id', label: 'Case' },
      { key: 'type', label: 'Type' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'assignee', label: 'Assignee' },
    ]}
    rows={[
      { id: 'CASE-1042', type: 'Abuse report', project: 'fake-react', status: 'open', assignee: 'ops@oss.tips' },
      { id: 'CASE-1038', type: 'Payment restriction', project: 'ledger-kit', status: 'investigating', assignee: 'finance@oss.tips' },
    ]}
  />
  <Button variant="primary" style="margin-top: 1rem;">Open new case</Button>
</AdminShell>
