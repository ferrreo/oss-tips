<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { formatDate, locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { labelAuditAction } from '../../lib/labels.js';
  import { admin } from '../../styles/admin.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import { adminNav, auditEvents as defaultEvents, displayPerson, displayTarget } from './admin-demo.js';
  import type { AdminAuditPageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin/audit'),
    events = defaultEvents,
    initialFilter = '',
    state: pageState = 'ready',
  }: AdminAuditPageProps = $props();

  // svelte-ignore state_referenced_locally -- initial filter is a story/route seed; later edits stay local.
  let filter = $state(initialFilter);

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);

  const auditActionKeys: Record<string, string> = {
    'project.review.hold': 'admin.audit.action.reviewHold',
    'project.review.approve': 'admin.audit.action.reviewApprove',
    'project.review.reject': 'admin.audit.action.reviewReject',
    'refund.exceptional': 'admin.audit.action.exceptionalRefund',
    'project.restrict.payments': 'admin.audit.action.restrictPayments',
    'case.open': 'admin.audit.action.caseOpen',
    'account.recovery.start': 'admin.audit.action.recoveryStart',
    'reconciliation.flag': 'admin.audit.action.reconciliationFlag',
    'project.fee_mode.change': 'admin.audit.action.feeModeChange',
    'api_key.revoke': 'admin.audit.action.apiKeyRevoke',
    'view_as.start': 'admin.audit.action.viewAsStart',
  };

  const rows = $derived(
    events
      .filter((event) => {
        const query = filter.trim().toLowerCase();
        if (!query) return true;
        return (
          event.actor.toLowerCase().includes(query) ||
          displayPerson(event.actor).toLowerCase().includes(query) ||
          event.action.toLowerCase().includes(query) ||
          labelAuditAction(event.action).toLowerCase().includes(query) ||
          event.target.toLowerCase().includes(query) ||
          displayTarget(event.target).toLowerCase().includes(query) ||
          event.reason.toLowerCase().includes(query) ||
          event.correlation.toLowerCase().includes(query)
        );
      })
      .map((event) => ({
        time: formatDate(event.time, $locale, { dateStyle: 'medium', timeStyle: 'short' }),
        actor: displayPerson(event.actor),
        action: auditActionKeys[event.action] ? tt(auditActionKeys[event.action]!) : labelAuditAction(event.action),
        target: displayTarget(event.target),
        reason: event.reason,
        correlation: event.correlation,
      })),
  );
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.audit')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.auditContext')}
        detail={tt('admin.operator.auditDetail')}
      />

      <TextField
        label={tt('admin.audit.filterLabel')}
        name="audit-filter"
        bind:value={filter}
        type="search"
        placeholder={tt('admin.audit.filterPlaceholder')}
      />

      <div {...stylex.attrs(admin.tableWrap)}>
        <Table
          caption={tt('admin.audit.eventsShown', { shown: rows.length, total: events.length })}
          columns={[
            { key: 'time', label: tt('admin.audit.time') },
            { key: 'actor', label: tt('admin.audit.actor') },
            { key: 'action', label: tt('admin.audit.action') },
            { key: 'target', label: tt('admin.audit.target') },
            { key: 'reason', label: tt('admin.audit.reason') },
            { key: 'correlation', label: tt('admin.audit.correlation') },
          ]}
          rows={rows}
        />
      </div>

      <p {...stylex.attrs(admin.footnote)}>
        {tt('admin.audit.footnote')}
      </p>
    </div>
  {/if}
</AdminShell>
