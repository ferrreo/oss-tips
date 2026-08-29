<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import Badge from '../../components/Badge.svelte';
  import TextField from '../../components/TextField.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { labelRisk } from '../../lib/labels.js';
  import { adminNav, requireItem, reviewQueue } from './admin-demo.js';

  let filter = $state('all');
  let selectedId = $state(requireItem(reviewQueue, 'reviewQueue').id);
  let reason = $state('');

  const selected = $derived(reviewQueue.find((item) => item.id === selectedId) ?? requireItem(reviewQueue, 'reviewQueue'));

  const visible = $derived(
    reviewQueue.filter((item) => (filter === 'all' ? true : item.risk === filter)),
  );
</script>

<AdminShell navGroups={adminNav('/admin/review')} title="Review queue">
  <AdminOperatorBar
    context="Reviewing {selected.name}"
    detail="{selected.repository}. Approve or reject only with a reason. That writes an audit event."
  />

  <div class="pl-row pl-row--between" style="margin-bottom: 1rem; flex-wrap: wrap;">
    <p class="pl-muted" style="margin: 0;">
      {reviewQueue.length} items. First-payment activation, duplicate claims, and risk flags.
    </p>
    <div class="pl-row">
      <Badge variant="ochre">{reviewQueue.filter((i) => i.risk === 'high').length} {labelRisk('high')} risk</Badge>
      <Badge>{reviewQueue.filter((i) => i.queueDays >= 7).length} waiting 7 days or more</Badge>
    </div>
  </div>

  <SegmentedControl
    label="Risk filter"
    value={filter}
    options={[
      { value: 'all', label: 'All' },
      { value: 'high', label: labelRisk('high') },
      { value: 'medium', label: labelRisk('medium') },
      { value: 'low', label: labelRisk('low') },
    ]}
    onchange={(v) => (filter = v)}
  />

  <div style="margin-top: 1rem;">
    <Table
      caption="Select a row in the panel below. This table is the live operator queue."
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'project', label: 'Project' },
        { key: 'reason', label: 'Reason' },
        { key: 'risk', label: 'Risk' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'wait', label: 'Days waiting' },
      ]}
      rows={visible.map((item) => ({
        id: item.id,
        project: item.name,
        reason: item.reason,
        risk: labelRisk(item.risk),
        submitted: item.submitted,
        wait: item.queueDays,
      }))}
    />
  </div>

  <section class="pl-surface" style="margin-top: 1.5rem; padding: 1.25rem;">
    <h2 style="font-size: 1.125rem; margin-bottom: 0.5rem;">Decide on {selected.name}</h2>
    <p class="pl-muted" style="margin: 0 0 1rem; font-size: 0.875rem;">
      {selected.reason}. {selected.repository}, submitted {selected.submitted}.
    </p>
    <label class="pl-field__label" for="review-select">Queue item</label>
    <select
      id="review-select"
      class="pl-input pl-focus-ring"
      bind:value={selectedId}
      style="margin-bottom: 1rem;"
    >
      {#each reviewQueue as item (item.id)}
        <option value={item.id}>{item.name}, {item.reason}</option>
      {/each}
    </select>
    <TextField
      label="Reason for this decision"
      name="review-reason"
      bind:value={reason}
      placeholder="Required. Shown on the audit event."
      help="Approvals, holds, and rejections all need a reason."
    />
    <div class="pl-row" style="margin-top: 1rem; flex-wrap: wrap;">
      <Button variant="primary">Approve first payment</Button>
      <Button variant="secondary">Hold for more evidence</Button>
      <Button variant="destructive">Reject with reason</Button>
    </div>
  </section>
</AdminShell>
