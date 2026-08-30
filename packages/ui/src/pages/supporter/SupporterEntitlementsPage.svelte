<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import type { Entitlement } from '../../fixtures/demo.js';
  import { formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import {
    supporterEntitlements as defaultEntitlements,
  } from './supporter-demo.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterEntitlementsPageProps {
    source?: 'demo' | 'db';
    entitlements?: Entitlement[];
    currentDate?: string;
    error?: string | undefined;
  }

  let {
    entitlements = defaultEntitlements,
    currentDate = '2026-08-29',
    error,
  }: SupporterEntitlementsPageProps = $props();

  function statusOf(entitlement: Entitlement): 'permanent' | 'active' | 'expired' {
    if (entitlement.permanent) return 'permanent';
    if (entitlement.expiresAt < currentDate) return 'expired';
    return 'active';
  }

  const permanent = $derived(entitlements.filter((entitlement) => statusOf(entitlement) === 'permanent'));
  const active = $derived(entitlements.filter((entitlement) => statusOf(entitlement) === 'active'));
  const expired = $derived(entitlements.filter((entitlement) => statusOf(entitlement) === 'expired'));
  const summaryAttrs = stylex.attrs(supporter.summaryGrid);
  const statusAttrs = stylex.attrs(supporter.statusLine);

  function statusLabel(status: 'permanent' | 'active' | 'expired', currentLocale: Locale): string {
    return t(
      status === 'permanent'
        ? 'supporter.entitlementStatus.permanent'
        : status === 'expired'
          ? 'supporter.entitlementStatus.expired'
          : 'supporter.entitlementStatus.active',
      {},
      currentLocale,
    );
  }

  function dateLabel(value: string, currentLocale: Locale): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('common.notAvailable', {}, currentLocale) : formatDate(date, currentLocale);
  }

  function expiresLabel(entitlement: Entitlement, currentLocale: Locale): string {
    return entitlement.permanent ? t('supporter.entitlements.permanent', {}, currentLocale) : dateLabel(entitlement.expiresAt, currentLocale);
  }
</script>

<SupporterPageFrame
  current="entitlements"
  title={t('supporter.entitlements.title', {}, $locale)}
  lede={t('supporter.entitlements.lede', {}, $locale)}
  {error}
>
  <div {...summaryAttrs}>
    <DataCard label={t('supporter.entitlements.active', {}, $locale)} value={String(active.length)} compare={t('supporter.entitlements.activeCompare', {}, $locale)} />
    <DataCard label={t('supporter.entitlements.permanent', {}, $locale)} value={String(permanent.length)} compare={t('supporter.entitlements.permanentCompare', {}, $locale)} />
    <DataCard label={t('supporter.entitlements.expired', {}, $locale)} value={String(expired.length)} compare={t('supporter.entitlements.expiredCompare', {}, $locale)} />
  </div>

  {#if entitlements.length > 0}
    <Table
      caption={t('supporter.entitlements.tableCaption', {}, $locale)}
      columns={[
        { key: 'project', label: t('supporter.entitlements.project', {}, $locale) },
        { key: 'tier', label: t('supporter.entitlements.tierReward', {}, $locale) },
        { key: 'expires', label: t('supporter.entitlements.expires', {}, $locale) },
        { key: 'status', label: t('supporter.entitlements.status', {}, $locale) },
        { key: 'source', label: t('supporter.entitlements.source', {}, $locale) },
      ]}
      rows={entitlements.map((entitlement) => ({
        project: entitlement.projectName,
        tier: entitlement.tierName,
        expires: expiresLabel(entitlement, $locale),
        status: statusLabel(statusOf(entitlement), $locale),
        source: entitlement.permanent
          ? t('supporter.entitlements.oneOff', {}, $locale)
          : t('supporter.entitlements.membership', {}, $locale),
      }))}
    />
  {:else}
    <EmptyState headingLevel={2} title={t('supporter.entitlements.noEntitlementsTitle', {}, $locale)} description={t('supporter.entitlements.noEntitlementsDescription', {}, $locale)} />
  {/if}

  <p {...statusAttrs}>
    <Badge variant="forest">{t('supporter.entitlements.activeCount', { count: active.length }, $locale)}</Badge>
    <Badge>{t('supporter.entitlements.permanentCount', { count: permanent.length }, $locale)}</Badge>
    <Badge variant="ochre">{t('supporter.entitlements.expiredCount', { count: expired.length }, $locale)}</Badge>
  </p>
</SupporterPageFrame>
