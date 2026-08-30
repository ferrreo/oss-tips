<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import AdminTable from './AdminTable.svelte';
  import TextField from '../../components/TextField.svelte';
  import { formatDate, formatNumber, locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { labelCaseStatus } from '../../lib/labels.js';
  import { admin } from '../../styles/admin.stylex.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import { adminCases as defaultCases, adminNav, displayPerson, displayProject } from './admin-demo.js';
  import type { AdminCasesPageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin/cases'),
    cases = defaultCases,
    initialFilter = 'openish',
    initialSelectedId,
    state: pageState = 'ready',
  }: AdminCasesPageProps = $props();

  // svelte-ignore state_referenced_locally -- route/story seeds are intentionally copied into local controls.
  let filter = $state(initialFilter);
  // svelte-ignore state_referenced_locally -- selected row is a local control seeded from route/story data.
  let selectedId = $state(initialSelectedId ?? cases[0]?.id ?? '');
  let note = $state('');

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);
  const caseStatusLabels: Record<string, string> = {
    open: 'admin.status.open',
    investigating: 'admin.status.investigating',
    waiting: 'admin.status.waiting',
    resolved: 'admin.status.resolved',
  };
  const caseStatusLabel = (value: string) => caseStatusLabels[value] ? tt(caseStatusLabels[value]!) : labelCaseStatus(value);
  const caseTypeLabels: Record<string, string> = {
    abuse_report: 'admin.cases.typeAbuse',
    abuse: 'admin.cases.typeAbuse',
    payment_restriction: 'admin.cases.typePayment',
    payment: 'admin.cases.typePayment',
    copyright_claim: 'admin.cases.typeCopyright',
    copyright: 'admin.cases.typeCopyright',
    account_recovery: 'admin.cases.typeRecovery',
    recovery: 'admin.cases.typeRecovery',
    ownership_transfer: 'admin.cases.typeOwnership',
    ownership: 'admin.cases.typeOwnership',
    exceptional_refund: 'admin.cases.typeRefund',
    refund: 'admin.cases.typeRefund',
  };
  const caseTypeLabel = (value: string) => {
    const key = caseTypeLabels[value.trim().toLowerCase().replace(/[\s-]+/g, '_')];
    return key ? tt(key) : value;
  };

  const selected = $derived(cases.find((item) => item.id === selectedId));
  const visible = $derived(
    cases.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'openish') return item.status !== 'resolved';
      return item.status === filter;
    }),
  );
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.cases')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else if cases.length === 0 || !selected}
    <AdminStatePanel state="empty" message={tt('admin.state.noCases')} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.casesContext', { id: selected.id, project: displayProject(selected.project) })}
        detail={tt('admin.operator.casesDetail', { type: caseTypeLabel(selected.type) })}
      />

      <div {...stylex.attrs(admin.toolbar)}>
        <p {...stylex.attrs(admin.footnote)}>{tt('admin.cases.footnote')}</p>
        <div {...stylex.attrs(admin.row)}>
          <Badge variant="danger">{formatNumber(cases.filter((item) => item.status === 'open').length, $locale)} {caseStatusLabel('open')}</Badge>
          <Badge variant="ochre">{formatNumber(cases.filter((item) => item.status === 'investigating').length, $locale)} {caseStatusLabel('investigating')}</Badge>
        </div>
      </div>

      <SegmentedControl
        label={tt('admin.cases.statusLabel')}
        value={filter}
        options={[
          { value: 'openish', label: tt('admin.cases.needsWork') },
          { value: 'open', label: caseStatusLabel('open') },
          { value: 'investigating', label: caseStatusLabel('investigating') },
          { value: 'waiting', label: caseStatusLabel('waiting') },
          { value: 'all', label: tt('admin.cases.all') },
        ]}
        onchange={(value) => (filter = value)}
      />

      <div {...stylex.attrs(admin.tableWrap)}>
        <AdminTable
          caption={tt('admin.cases.caption', { count: formatNumber(visible.length, $locale) })}
          columns={[
            { key: 'id', label: tt('admin.cases.case') },
            { key: 'type', label: tt('admin.cases.type') },
            { key: 'project', label: tt('admin.cases.project') },
            { key: 'status', label: tt('admin.cases.status') },
            { key: 'assignee', label: tt('admin.cases.assignee') },
            { key: 'opened', label: tt('admin.cases.opened') },
          ]}
          rows={visible.map((item) => ({
            id: item.id,
            type: caseTypeLabel(item.type),
            project: displayProject(item.project),
            status: caseStatusLabel(item.status),
            assignee: displayPerson(item.assignee),
            opened: formatDate(item.opened, $locale, { dateStyle: 'medium' }),
          }))}
        />
      </div>

      <section {...stylex.attrs(admin.surface)}>
        <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.cases.selectedHeading', { id: selected.id, project: displayProject(selected.project) })}</h2>
        <p>{selected.summary}</p>
        <label for="case-select">{tt('admin.cases.selectLabel')}</label>
        <select id="case-select" {...stylex.attrs(admin.select, primitives.focusRing)} bind:value={selectedId}>
          {#each cases as item (item.id)}
            <option value={item.id}>{item.id}, {displayProject(item.project)}</option>
          {/each}
        </select>
        <TextField
          label={tt('admin.cases.operatorNote')}
          name="reason"
          bind:value={note}
          placeholder={tt('admin.cases.notePlaceholder')}
          help={tt('admin.cases.noteHelp')}
          required
        />
        <div {...stylex.attrs(admin.row)}>
          <form method="POST" action="?/addNote">
            <input type="hidden" name="caseId" value={selected.id} />
            <input type="hidden" name="reason" value={note} />
            <Button type="submit" variant="primary" label={tt('admin.cases.saveNote')} />
          </form>
          <form method="POST" action="?/setStatus">
            <input type="hidden" name="caseId" value={selected.id} />
            <input type="hidden" name="status" value="resolved" />
            <input type="hidden" name="reason" value={note} />
            <Button type="submit" variant="secondary" label={tt('admin.cases.resolve')} />
          </form>
          <form method="POST" action="?/setStatus">
            <input type="hidden" name="caseId" value={selected.id} />
            <input type="hidden" name="status" value="investigating" />
            <input type="hidden" name="reason" value={note} />
            <Button type="submit" variant="secondary" label={tt('admin.cases.investigate')} />
          </form>
          <form method="POST" action="?/restrictPayments">
            <input type="hidden" name="caseId" value={selected.id} />
            <input type="hidden" name="reason" value={note} />
            <Button type="submit" variant="destructive" label={tt('admin.cases.restrict')} />
          </form>
        </div>
      </section>
    </div>
  {/if}
</AdminShell>
