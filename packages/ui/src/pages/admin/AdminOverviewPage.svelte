<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Table from '../../components/Table.svelte';
  import ChartPlaceholder from '../../components/ChartPlaceholder.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import {
    adminNav,
    reviewQueue,
    adminCases,
    failedJobs,
    reconciliationRows,
    formatMoney,
  } from './admin-demo.js';

  const openCases = adminCases.filter((c) => c.status !== 'resolved');
  const mismatches = reconciliationRows.filter((r) => r.status === 'mismatch');
</script>

<AdminShell navGroups={adminNav('/admin')} title="Platform overview">
  <AdminOperatorBar
    context="Operations workspace — not a project dashboard"
    detail="Privileged actions need a project in context and a written reason. Every change is appended to the audit log."
  />

  <StatusBanner
    variant="info"
    title="{reviewQueue.length} projects in the review queue"
    message="First-payment activation, duplicate claims, and impersonation flags. Oldest item has waited {reviewQueue[reviewQueue.length - 1].queueDays} days."
  />

  <div class="pl-grid-3" style="margin: 1.5rem 0;">
    <DataCard label="Published projects" value="1,248" compare="+12 this month" compareDirection="up" />
    <DataCard label="Review queue" value={String(reviewQueue.length)} compare="Action needed" />
    <DataCard label="Open cases" value={String(openCases.length)} compare="Abuse, recovery, refunds" />
  </div>
  <div class="pl-grid-3" style="margin-bottom: 1.5rem;">
    <DataCard label="Settlement volume (30d)" value="£2.4M" compare="+4% vs prior 30d" compareDirection="up" />
    <DataCard label="Platform fees + tips (30d)" value="£48,210" compare="Tips £6,140" />
    <DataCard
      label="Reconciliation mismatches"
      value={String(mismatches.length)}
      compare="Stripe vs ledger"
      compareDirection="down"
    />
  </div>

  <ChartPlaceholder label="Settled volume by day" range="Last 30 days · Europe/London" />

  <h2 style="font-size: 1.125rem; margin: 2rem 0 0.75rem;">Review queue snapshot</h2>
  <Table
    caption="Oldest items first. Full queue is under Review."
    columns={[
      { key: 'project', label: 'Project' },
      { key: 'reason', label: 'Reason' },
      { key: 'risk', label: 'Risk' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'wait', label: 'Days waiting' },
    ]}
    rows={reviewQueue.map((item) => ({
      project: item.project,
      reason: item.reason,
      risk: item.risk,
      submitted: item.submitted,
      wait: item.queueDays,
    }))}
  />

  <div class="pl-grid-2" style="margin-top: 2rem;">
    <section>
      <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">Open cases</h2>
      <Table
        columns={[
          { key: 'id', label: 'Case' },
          { key: 'type', label: 'Type' },
          { key: 'project', label: 'Project' },
          { key: 'status', label: 'Status' },
        ]}
        rows={openCases.map((c) => ({
          id: c.id,
          type: c.type,
          project: c.project,
          status: c.status,
        }))}
      />
    </section>
    <section>
      <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">Failed jobs</h2>
      <Table
        columns={[
          { key: 'kind', label: 'Kind' },
          { key: 'target', label: 'Target' },
          { key: 'retries', label: 'Retries' },
          { key: 'error', label: 'Last error' },
        ]}
        rows={failedJobs.map((job) => ({
          kind: job.kind,
          target: job.target,
          retries: job.retries,
          error: job.lastError,
        }))}
      />
    </section>
  </div>

  <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 1.5rem;">
    Settlement figure is settled Stripe net after processing fees. Platform revenue is oss.tips project fees plus supporter tips, shown separately as {formatMoney(4207000)} fees and {formatMoney(614000)} tips this month.
  </p>
</AdminShell>
