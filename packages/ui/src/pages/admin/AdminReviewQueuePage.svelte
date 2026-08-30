<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { formatDate, formatNumber, locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { labelRisk } from '../../lib/labels.js';
  import { admin } from '../../styles/admin.stylex.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import { adminNav, reviewQueue as defaultReviewItems } from './admin-demo.js';
  import type { AdminReviewQueuePageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin/review'),
    reviewItems = defaultReviewItems,
    initialFilter = 'all',
    initialSelectedId,
    state: pageState = 'ready',
  }: AdminReviewQueuePageProps = $props();

  // svelte-ignore state_referenced_locally -- route/story seeds are intentionally copied into local controls.
  let filter = $state(initialFilter);
  // svelte-ignore state_referenced_locally -- selected row is a local control seeded from route/story data.
  let selectedId = $state(initialSelectedId ?? reviewItems[0]?.id ?? '');
  let reason = $state('');

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);
  const riskLabels: Record<string, string> = {
    high: 'admin.status.high',
    medium: 'admin.status.medium',
    low: 'admin.status.low',
  };
  const riskLabel = (value: string) => riskLabels[value] ? tt(riskLabels[value]!) : labelRisk(value);

  const selected = $derived(reviewItems.find((item) => item.id === selectedId));
  const visible = $derived(reviewItems.filter((item) => (filter === 'all' ? true : item.risk === filter)));
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.reviewQueue')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else if reviewItems.length === 0 || !selected}
    <AdminStatePanel state="empty" message={tt('admin.state.noReview')} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.reviewContext', { name: selected.name })}
        detail={tt('admin.operator.reviewDetail', { repository: selected.repository })}
      />

      <div {...stylex.attrs(admin.toolbar)}>
        <p {...stylex.attrs(admin.footnote)}>
          {tt('admin.review.footnote', { count: formatNumber(reviewItems.length, $locale) })}
        </p>
        <div {...stylex.attrs(admin.row)}>
          <Badge variant="ochre">{tt('admin.review.highRisk', { count: formatNumber(reviewItems.filter((item) => item.risk === 'high').length, $locale) })}</Badge>
          <Badge>{tt('admin.review.waitingLong', { count: formatNumber(reviewItems.filter((item) => item.queueDays >= 7).length, $locale) })}</Badge>
        </div>
      </div>

      <SegmentedControl
        label={tt('admin.review.filterLabel')}
        value={filter}
        options={[
          { value: 'all', label: tt('admin.review.all') },
          { value: 'high', label: riskLabel('high') },
          { value: 'medium', label: riskLabel('medium') },
          { value: 'low', label: riskLabel('low') },
        ]}
        onchange={(value) => (filter = value)}
      />

      <div {...stylex.attrs(admin.tableWrap)}>
        <Table
          caption={tt('admin.review.caption')}
          columns={[
            { key: 'id', label: tt('admin.review.id') },
            { key: 'project', label: tt('admin.review.project') },
            { key: 'reason', label: tt('admin.review.reason') },
            { key: 'risk', label: tt('admin.review.risk') },
            { key: 'submitted', label: tt('admin.review.submitted') },
            { key: 'wait', label: tt('admin.review.daysWaiting') },
          ]}
          rows={visible.map((item) => ({
            id: item.id,
            project: item.name,
            reason: item.reason,
            risk: riskLabel(item.risk),
            submitted: formatDate(item.submitted, $locale, { dateStyle: 'medium' }),
            wait: formatNumber(item.queueDays, $locale),
          }))}
        />
      </div>

      <section {...stylex.attrs(admin.surface)}>
        <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.review.decideHeading', { name: selected.name })}</h2>
        <p>{tt('admin.review.decideSummary', { reason: selected.reason, repository: selected.repository, submitted: formatDate(selected.submitted, $locale, { dateStyle: 'medium' }) })}</p>
        <label for="review-select">{tt('admin.review.queueItem')}</label>
        <select id="review-select" {...stylex.attrs(admin.select, primitives.focusRing)} bind:value={selectedId}>
          {#each reviewItems as item (item.id)}
            <option value={item.id}>{item.name}, {item.reason}</option>
          {/each}
        </select>
        <TextField
          label={tt('admin.review.decisionReason')}
          name="review-reason"
          bind:value={reason}
          placeholder={tt('admin.review.reasonPlaceholder')}
          help={tt('admin.review.reasonHelp')}
          required
        />
        <div {...stylex.attrs(admin.row)}>
          <form method="POST" action="?/approve">
            <input type="hidden" name="reviewId" value={selected.id} />
            <input type="hidden" name="reason" value={reason} />
            <Button type="submit" variant="primary" label={tt('admin.review.approve')} />
          </form>
          <form method="POST" action="?/hold">
            <input type="hidden" name="reviewId" value={selected.id} />
            <input type="hidden" name="reason" value={reason} />
            <Button type="submit" variant="secondary" label={tt('admin.review.hold')} />
          </form>
          <form method="POST" action="?/reject">
            <input type="hidden" name="reviewId" value={selected.id} />
            <input type="hidden" name="reason" value={reason} />
            <Button type="submit" variant="destructive" label={tt('admin.review.reject')} />
          </form>
        </div>
      </section>
    </div>
  {/if}
</AdminShell>
