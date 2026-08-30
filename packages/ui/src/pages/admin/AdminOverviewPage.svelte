<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import SupportOverTimeChart from '../../components/SupportOverTimeChart.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import AdminTable from './AdminTable.svelte';
  import { formatCurrency, formatDate, formatNumber, locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { labelCaseStatus, labelRisk } from '../../lib/labels.js';
  import { admin } from '../../styles/admin.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import {
    adminCases as defaultCases,
    adminNav,
    displayProject,
    displayTarget,
    failedJobs as defaultFailedJobs,
    reconciliationRows as defaultReconciliation,
    reviewQueue as defaultReviewItems,
  } from './admin-demo.js';
  import type { AdminOverviewAmount, AdminOverviewPageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin'),
    overviewMetrics,
    reviewItems = defaultReviewItems,
    cases = defaultCases,
    reconciliation = defaultReconciliation,
    failedJobs = defaultFailedJobs,
    state: pageState = 'ready',
  }: AdminOverviewPageProps = $props();

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);
  const riskLabels: Record<string, string> = {
    high: 'admin.status.high',
    medium: 'admin.status.medium',
    low: 'admin.status.low',
  };
  const caseStatusLabels: Record<string, string> = {
    open: 'admin.status.open',
    investigating: 'admin.status.investigating',
    waiting: 'admin.status.waiting',
    resolved: 'admin.status.resolved',
  };
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
  const jobKindLabels: Record<string, string> = {
    webhook_deliver: 'admin.job.webhookDeliver',
    discord_role_sync: 'admin.job.discordRoleSync',
    domain_challenge: 'admin.job.domainChallenge',
    stripe_capability: 'admin.job.stripeCapability',
    post_publish: 'admin.job.postPublish',
    post_notify_supporters: 'admin.job.postNotifySupporters',
    project_export: 'admin.job.projectExport',
  };
  const statusLabel = (value: string, labels: Record<string, string>, fallback: (value: string) => string) =>
    labels[value] ? tt(labels[value]!) : fallback(value);
  const knownLabel = (value: string, labels: Record<string, string>) => {
    const key = labels[value.trim().toLowerCase().replace(/[\s.-]+/g, '_')];
    return key ? tt(key) : value;
  };

  const formatMetric = (metric: AdminOverviewAmount | null) =>
    metric ? formatCurrency(metric.amountMinor, metric.currency, $locale) : tt('common.notAvailable');
  const publishedCompare = $derived(tt('admin.overview.publishedThisMonth', { count: overviewMetrics.publishedThisMonth }));
  const settlementChange = $derived.by(() => {
    const current = overviewMetrics.settlementVolume;
    const previous = overviewMetrics.previousSettlementVolume;
    if (!current || !previous || current.currency !== previous.currency || previous.amountMinor === 0) return null;
    return Math.round(((current.amountMinor - previous.amountMinor) / previous.amountMinor) * 100);
  });
  const settlementCompare = $derived(
    settlementChange === null ? '' : tt('admin.overview.priorPeriodChange', { percent: settlementChange }),
  );
  const settlementCompareDirection = $derived(
    settlementChange === null ? 'neutral' : settlementChange > 0 ? 'up' : settlementChange < 0 ? 'down' : 'neutral',
  );
  const tipsCompare = $derived(
    overviewMetrics.tips
      ? tt('admin.overview.tipsValue', { amount: formatCurrency(overviewMetrics.tips.amountMinor, overviewMetrics.tips.currency, $locale) })
      : '',
  );
  const metricUnavailableMessage = $derived(
    overviewMetrics.currencyCodes.length > 1 ? tt('admin.overview.multipleCurrencies') : tt('admin.overview.noSettlementData'),
  );
  const overviewSeries = $derived(
    overviewMetrics.settledVolumeSeries.map((series) => ({
      id: series.id,
      label: `${tt(series.labelKey)} (${series.currency})`,
      points: series.points,
      ...(series.stroke ? { stroke: series.stroke } : {}),
      ...(series.marker ? { marker: series.marker } : {}),
    })),
  );
  const openCases = $derived(cases.filter((item) => item.status !== 'resolved'));
  const mismatches = $derived(reconciliation.filter((item) => item.status === 'mismatch'));
  const oldestReview = $derived(reviewItems.slice().sort((a, b) => b.queueDays - a.queueDays)[0]);
  const mismatchValue = $derived(
    overviewMetrics.reconciliationAvailable ? formatNumber(mismatches.length, $locale) : tt('common.notAvailable'),
  );
  const mismatchCompare = $derived(overviewMetrics.reconciliationAvailable ? tt('admin.overview.stripeLedger') : '');
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.overview')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.overviewContext')}
        detail={tt('admin.operator.overviewDetail')}
      />

      <StatusBanner
        variant="info"
        title={tt('admin.overview.reviewQueueTitle', { count: reviewItems.length })}
        message={oldestReview
          ? tt('admin.overview.reviewQueueMessage', { days: oldestReview.queueDays })
          : tt('admin.overview.reviewQueueEmpty')}
      />

      <div {...stylex.attrs(admin.grid3)}>
        <DataCard label={tt('admin.overview.publishedProjects')} value={formatNumber(overviewMetrics.publishedProjects, $locale)} compare={publishedCompare} compareDirection="up" />
        <DataCard label={tt('admin.overview.reviewQueue')} value={formatNumber(reviewItems.length, $locale)} compare={tt('admin.overview.actionNeeded')} />
        <DataCard label={tt('admin.overview.openCases')} value={formatNumber(openCases.length, $locale)} compare={tt('admin.overview.caseKinds')} />
        <DataCard label={tt('admin.overview.settlementVolume')} value={formatMetric(overviewMetrics.settlementVolume)} compare={settlementCompare} compareDirection={settlementCompareDirection} />
        <DataCard label={tt('admin.overview.feesTips')} value={formatMetric(overviewMetrics.fees)} compare={tipsCompare} />
        <DataCard
          label={tt('admin.overview.reconciliationMismatches')}
          value={mismatchValue}
          compare={mismatchCompare}
          compareDirection={overviewMetrics.reconciliationAvailable ? 'down' : 'neutral'}
        />
      </div>

      {#if overviewSeries.length > 0}
        <SupportOverTimeChart
          label={tt('admin.overview.settledVolume')}
          range={tt('admin.overview.last30Days')}
          series={overviewSeries}
          unit={overviewMetrics.currencyCodes.length === 1 ? overviewMetrics.currencyCodes[0] ?? '' : ''}
        />
      {:else}
        <section {...stylex.attrs(admin.section)}>
          <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.overview.settledVolume')}</h2>
          <p {...stylex.attrs(admin.footnote)}>{metricUnavailableMessage}</p>
        </section>
      {/if}

      <section {...stylex.attrs(admin.section)}>
        <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.overview.reviewSnapshot')}</h2>
        <AdminTable
          caption={tt('admin.overview.oldestFirst')}
          columns={[
            { key: 'project', label: tt('admin.overview.project') },
            { key: 'reason', label: tt('admin.overview.reason') },
            { key: 'risk', label: tt('admin.overview.risk') },
            { key: 'submitted', label: tt('admin.overview.submitted') },
            { key: 'wait', label: tt('admin.overview.daysWaiting') },
          ]}
          rows={reviewItems.map((item) => ({
            project: item.name,
            reason: item.reason,
            risk: statusLabel(item.risk, riskLabels, labelRisk),
            submitted: formatDate(item.submitted, $locale, { dateStyle: 'medium' }),
            wait: formatNumber(item.queueDays, $locale),
          }))}
        />
      </section>

      <div {...stylex.attrs(admin.grid2)}>
        <section {...stylex.attrs(admin.section)}>
          <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.overview.openCasesTitle')}</h2>
          <AdminTable
            caption={tt('admin.overview.openCasesTitle')}
            columns={[
              { key: 'id', label: tt('admin.overview.case') },
              { key: 'type', label: tt('admin.overview.type') },
              { key: 'project', label: tt('admin.overview.project') },
              { key: 'status', label: tt('admin.overview.status') },
            ]}
            rows={openCases.map((item) => ({
              id: item.id,
              type: knownLabel(item.type, caseTypeLabels),
              project: displayProject(item.project),
              status: statusLabel(item.status, caseStatusLabels, labelCaseStatus),
            }))}
          />
        </section>
        <section {...stylex.attrs(admin.section)}>
          <h2 {...stylex.attrs(admin.sectionHeading)}>{tt('admin.overview.failedJobs')}</h2>
          <AdminTable
            caption={tt('admin.overview.failedJobs')}
            columns={[
              { key: 'kind', label: tt('admin.overview.kind') },
              { key: 'target', label: tt('admin.overview.target') },
              { key: 'retries', label: tt('admin.overview.retries') },
              { key: 'error', label: tt('admin.overview.lastError') },
            ]}
            rows={failedJobs.map((job) => ({
              kind: knownLabel(job.kind, jobKindLabels),
              target: displayTarget(job.target),
              retries: formatNumber(job.retries, $locale),
              error: job.lastError,
            }))}
          />
        </section>
      </div>

      <p {...stylex.attrs(admin.footnote)}>
        {tt('admin.overview.footnote30d', { fees: formatMetric(overviewMetrics.fees), tips: formatMetric(overviewMetrics.tips) })}
      </p>
    </div>
  {/if}
</AdminShell>
