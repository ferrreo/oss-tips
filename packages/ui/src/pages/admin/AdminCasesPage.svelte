<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import TextField from '../../components/TextField.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { adminCases, adminNav, displayPerson, displayProject, humanizeStatus, requireItem } from './admin-demo.js';

  let filter = $state('openish');
  let selectedId = $state(requireItem(adminCases, 'adminCases').id);
  let note = $state('');

  const selected = $derived(adminCases.find((c) => c.id === selectedId) ?? requireItem(adminCases, 'adminCases'));

  const visible = $derived(
    adminCases.filter((c) => {
      if (filter === 'all') return true;
      if (filter === 'openish') return c.status !== 'resolved';
      return c.status === filter;
    }),
  );
</script>

<AdminShell navGroups={adminNav('/admin/cases')} title="Cases">
  <AdminOperatorBar
    context="{selected.id} on {displayProject(selected.project)}"
    detail="{selected.type}. Restrictions, refunds, and ownership changes stay on this case."
  />

  <div class="pl-row pl-row--between" style="margin-bottom: 1rem; flex-wrap: wrap;">
    <p class="pl-muted" style="margin: 0;">Abuse, copyright, recovery, ownership, and payment restrictions.</p>
    <div class="pl-row">
      <Badge variant="danger">{adminCases.filter((c) => c.status === 'open').length} open</Badge>
      <Badge variant="ochre">{adminCases.filter((c) => c.status === 'investigating').length} investigating</Badge>
    </div>
  </div>

  <SegmentedControl
    label="Case status"
    value={filter}
    options={[
      { value: 'openish', label: 'Needs work' },
      { value: 'open', label: 'Open' },
      { value: 'investigating', label: 'Investigating' },
      { value: 'waiting', label: 'Waiting' },
      { value: 'all', label: 'All' },
    ]}
    onchange={(v) => (filter = v)}
  />

  <div style="margin-top: 1rem;">
    <Table
      caption="{visible.length} cases in this filter."
      columns={[
        { key: 'id', label: 'Case' },
        { key: 'type', label: 'Type' },
        { key: 'project', label: 'Project' },
        { key: 'status', label: 'Status' },
        { key: 'assignee', label: 'Assignee' },
        { key: 'opened', label: 'Opened' },
      ]}
      rows={visible.map((c) => ({
        id: c.id,
        type: c.type,
        project: displayProject(c.project),
        status: humanizeStatus(c.status),
        assignee: displayPerson(c.assignee),
        opened: c.opened,
      }))}
    />
  </div>

  <section class="pl-surface" style="margin-top: 1.5rem; padding: 1.25rem;">
    <h2 style="font-size: 1.125rem; margin-bottom: 0.5rem;">{selected.id}, {displayProject(selected.project)}</h2>
    <p style="margin: 0 0 1rem;">{selected.summary}</p>
    <label class="pl-field__label" for="case-select">Case</label>
    <select id="case-select" class="pl-input pl-focus-ring" bind:value={selectedId} style="margin-bottom: 1rem;">
      {#each adminCases as c (c.id)}
        <option value={c.id}>{c.id}, {displayProject(c.project)}</option>
      {/each}
    </select>
    <TextField
      label="Operator note"
      name="case-note"
      bind:value={note}
      placeholder="Visible to other operators. Not sent to the project."
      help="Notes are case history. Privileged actions still need their own reason field."
    />
    <div class="pl-row" style="margin-top: 1rem; flex-wrap: wrap;">
      <Button variant="primary">Open new case</Button>
      <Button variant="secondary">Restrict payments</Button>
      <Button variant="destructive">Issue exceptional refund</Button>
    </div>
  </section>
</AdminShell>
