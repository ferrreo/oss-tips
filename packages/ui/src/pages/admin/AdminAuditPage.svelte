<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { labelAuditAction } from '../../lib/labels.js';
  import { adminNav, auditEvents, displayPerson, displayTarget } from './admin-demo.js';

  let filter = $state('');

  const rows = $derived(
    auditEvents
      .filter((e) => {
        const q = filter.trim().toLowerCase();
        if (!q) return true;
        return (
          e.actor.toLowerCase().includes(q) ||
          displayPerson(e.actor).toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          labelAuditAction(e.action).toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          displayTarget(e.target).toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q) ||
          e.correlation.toLowerCase().includes(q)
        );
      })
      .map((e) => ({
        time: e.time,
        actor: displayPerson(e.actor),
        action: labelAuditAction(e.action),
        target: displayTarget(e.target),
        reason: e.reason,
        correlation: e.correlation,
      })),
  );
</script>

<AdminShell navGroups={adminNav('/admin/audit')} title="Audit log">
  <AdminOperatorBar
    context="Privileged actions, newest first"
    detail="Rows cannot be edited or deleted. A correction is a new event. Financial and access events are kept for seven years."
  />

  <TextField
    label="Filter by actor, action, target, reason, or correlation"
    name="audit-filter"
    bind:value={filter}
    type="search"
    placeholder="exceptional refund or fake-react"
  />

  <div style="margin-top: 1rem;">
    <Table
      caption="{rows.length} of {auditEvents.length} events shown. Newest first."
      columns={[
        { key: 'time', label: 'Time (UTC)' },
        { key: 'actor', label: 'Actor' },
        { key: 'action', label: 'Action' },
        { key: 'target', label: 'Target' },
        { key: 'reason', label: 'Reason' },
        { key: 'correlation', label: 'Correlation' },
      ]}
      rows={rows}
    />
  </div>

  <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 1rem;">
    Each row has the actor, action, project, reason, and a correlation id. View-as is read-only and still writes a row.
  </p>
</AdminShell>
