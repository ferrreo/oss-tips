<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { adminNav, auditEvents } from './admin-demo.js';

  let filter = $state('');

  const rows = $derived(
    auditEvents
      .filter((e) => {
        const q = filter.trim().toLowerCase();
        if (!q) return true;
        return (
          e.actor.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q) ||
          e.correlation.toLowerCase().includes(q)
        );
      })
      .map((e) => ({
        time: e.time,
        actor: e.actor,
        action: e.action,
        target: e.target,
        reason: e.reason,
        correlation: e.correlation,
      })),
  );
</script>

<AdminShell navGroups={adminNav('/admin/audit')} title="Audit log">
  <AdminOperatorBar
    context="Append-only privileged-action log"
    detail="No update or delete API. Corrections are new events. Retention is seven years for financial and access actions."
  />

  <TextField
    label="Filter by actor, action, target, reason, or correlation"
    name="audit-filter"
    bind:value={filter}
    type="search"
    placeholder="e.g. refund.exceptional or fake-react"
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
    Fields stored: occurred_at, actor, session, action, resource, project, reason, ip_hash, before/after hash, correlation_id, redacted metadata. View-as is a read-only simulated policy and always writes an event.
  </p>
</AdminShell>
