<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import type { Entitlement, Membership, Thread } from '../../fixtures/demo.js';
  import { formatCadence, formatCurrency, formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import {
    lifetimeSupport as defaultLifetimeSupport,
    supporterEntitlements as defaultEntitlements,
    supporterMemberships as defaultMemberships,
    supporterName as defaultSupporterName,
    supporterThreads as defaultThreads,
  } from './supporter-demo.js';
  import type { LifetimeSupport } from './supporter-demo.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterHomePageProps {
    source?: 'demo' | 'db';
    supporterName?: string;
    memberships?: Membership[];
    entitlements?: Entitlement[];
    threads?: Thread[];
    lifetimeSupport?: LifetimeSupport[];
    currentDate?: string;
    error?: string | undefined;
  }

  let {
    supporterName = defaultSupporterName,
    memberships = defaultMemberships,
    entitlements = defaultEntitlements,
    threads = defaultThreads,
    lifetimeSupport = defaultLifetimeSupport,
    currentDate = '2026-08-29',
    error,
  }: SupporterHomePageProps = $props();

  const activeMemberships = $derived(memberships.filter((membership) => membership.status === 'active'));
  const liveEntitlements = $derived(
    entitlements.filter((entitlement) => entitlement.permanent || (entitlement.expiresAt && entitlement.expiresAt >= currentDate)),
  );
  const lifetimeCurrencies = $derived(new Set(lifetimeSupport.map((row) => row.currency.toUpperCase())));
  const lifetimeTotalMinor = $derived(
    lifetimeSupport.length === 0 || lifetimeCurrencies.size > 1
      ? undefined
      : lifetimeSupport.reduce((sum, row) => sum + row.oneOffMinor + row.recurringMinor, 0),
  );
  const activeMembershipCurrencies = $derived(
    new Set(activeMemberships.map((membership) => membership.currency.toUpperCase())),
  );
  const monthlyActiveMinor = $derived(
    activeMemberships.length === 0 || activeMembershipCurrencies.size > 1
      ? undefined
      : activeMemberships.reduce(
          (sum, membership) =>
            sum + (membership.cadence === 'annual' ? Math.round(membership.amountMinor / 12) : membership.amountMinor),
          0,
        ),
  );
  const lifetimeCurrency = $derived(lifetimeSupport[0]?.currency ?? memberships[0]?.currency ?? 'GBP');
  const membershipCurrency = $derived(activeMemberships[0]?.currency ?? memberships[0]?.currency ?? 'GBP');
  const unreadThreadCount = $derived(threads.filter((thread) => thread.unread).length);
  const lifetimeCompare = $derived(
    lifetimeCurrencies.size > 1
      ? t('supporter.home.multipleCurrencies', {}, $locale)
      : t('supporter.home.acrossProjects', { count: lifetimeSupport.length }, $locale),
  );
  const monthlyEquivalent = $derived(
    activeMembershipCurrencies.size > 1
      ? t('supporter.home.multipleCurrencies', {}, $locale)
      : monthlyActiveMinor === undefined
        ? t('common.notAvailable', {}, $locale)
        : t('supporter.home.monthlyEquivalent', { amount: formatCurrency(monthlyActiveMinor, membershipCurrency, $locale) }, $locale),
  );

  function membershipStatusLabel(status: Membership['status'], currentLocale: Locale): string {
    return t(
      status === 'active'
        ? 'supporter.membershipStatus.active'
        : status === 'past_due'
          ? 'supporter.membershipStatus.pastDue'
          : 'supporter.membershipStatus.cancelled',
      {},
      currentLocale,
    );
  }

  function entitlementStatusLabel(status: string, currentLocale: Locale): string {
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

  const summaryAttrs = stylex.attrs(supporter.summaryGrid);
  const sectionAttrs = stylex.attrs(supporter.section);
  const sectionTitleAttrs = stylex.attrs(supporter.sectionTitle);
  const introAttrs = stylex.attrs(supporter.sectionIntro);
  const statusAttrs = stylex.attrs(supporter.statusLine);
</script>

<SupporterPageFrame
  current="home"
  title={t('supporter.home.title', {}, $locale)}
  lede={t('supporter.home.lede', { name: supporterName }, $locale)}
  {error}
>
  <div {...summaryAttrs}>
    <DataCard
      label={t('supporter.home.lifetimeSupport', {}, $locale)}
      value={lifetimeTotalMinor === undefined ? t('common.notAvailable', {}, $locale) : formatCurrency(lifetimeTotalMinor, lifetimeCurrency, $locale)}
      compare={lifetimeCompare}
    />
    <DataCard
      label={t('supporter.home.activeMemberships', {}, $locale)}
      value={String(activeMemberships.length)}
      compare={monthlyEquivalent}
    />
    <DataCard
      label={t('supporter.home.unreadMessages', {}, $locale)}
      value={String(unreadThreadCount)}
      compare={t('supporter.home.fromSupportedProjects', {}, $locale)}
      compareDirection={unreadThreadCount > 0 ? 'up' : 'neutral'}
    />
  </div>

  <section {...sectionAttrs} aria-labelledby="supporter-memberships-title">
    <h2 id="supporter-memberships-title" {...sectionTitleAttrs}>{t('supporter.home.membershipsHeading', {}, $locale)}</h2>
    <p {...introAttrs}>{t('supporter.home.membershipsIntro', {}, $locale)}</p>
    {#if memberships.length > 0}
      <Table
        caption={t('supporter.home.membershipCaption', {}, $locale)}
        columns={[
          { key: 'project', label: t('supporter.home.project', {}, $locale) },
          { key: 'tier', label: t('supporter.home.tier', {}, $locale) },
          { key: 'amount', label: t('supporter.home.amount', {}, $locale) },
          { key: 'status', label: t('supporter.home.status', {}, $locale) },
          { key: 'renews', label: t('supporter.home.renews', {}, $locale) },
        ]}
        rows={memberships.map((membership) => ({
          project: membership.projectName,
          tier: membership.tierName,
          amount: `${formatCurrency(membership.amountMinor, membership.currency, $locale)} / ${formatCadence(membership.cadence, $locale)}`,
          status: membershipStatusLabel(membership.status, $locale),
          renews: dateLabel(membership.renewsAt, $locale),
        }))}
      />
    {:else}
      <EmptyState title={t('supporter.home.noMembershipsTitle', {}, $locale)} description={t('supporter.home.noMembershipsDescription', {}, $locale)} />
    {/if}
  </section>

  <section {...sectionAttrs} aria-labelledby="supporter-entitlements-title">
    <h2 id="supporter-entitlements-title" {...sectionTitleAttrs}>{t('supporter.home.entitlementsHeading', {}, $locale)}</h2>
    <p {...introAttrs}>{t('supporter.home.entitlementsIntro', { count: liveEntitlements.length }, $locale)}</p>
    {#if entitlements.length > 0}
      <Table
        caption={t('supporter.home.entitlementCaption', {}, $locale)}
        columns={[
          { key: 'project', label: t('supporter.home.project', {}, $locale) },
          { key: 'tier', label: t('supporter.home.tierReward', {}, $locale) },
          { key: 'expires', label: t('supporter.home.expires', {}, $locale) },
          { key: 'status', label: t('supporter.home.status', {}, $locale) },
        ]}
        rows={entitlements.map((entitlement) => {
          const expired = !entitlement.permanent && entitlement.expiresAt < currentDate;
          const status = entitlement.permanent ? 'permanent' : expired ? 'expired' : 'active';
          return {
            project: entitlement.projectName,
            tier: entitlement.tierName,
            status: entitlementStatusLabel(status, $locale),
            expires: expiresLabel(entitlement, $locale),
          };
        })}
      />
    {:else}
      <EmptyState title={t('supporter.home.noEntitlementsTitle', {}, $locale)} description={t('supporter.home.noEntitlementsDescription', {}, $locale)} />
    {/if}
  </section>

  <section {...sectionAttrs} aria-labelledby="supporter-lifetime-title">
    <h2 id="supporter-lifetime-title" {...sectionTitleAttrs}>{t('supporter.home.lifetimeHeading', {}, $locale)}</h2>
    <p {...introAttrs}>{t('supporter.home.lifetimeIntro', {}, $locale)}</p>
    {#if lifetimeSupport.length > 0}
      <Table
        caption={t('supporter.home.lifetimeCaption', {}, $locale)}
        columns={[
          { key: 'project', label: t('supporter.home.project', {}, $locale) },
          { key: 'oneOff', label: t('supporter.home.oneOff', {}, $locale) },
          { key: 'recurring', label: t('supporter.home.recurring', {}, $locale) },
          { key: 'total', label: t('supporter.home.lifetime', {}, $locale) },
        ]}
        rows={lifetimeSupport.map((row) => ({
          project: row.projectName,
          oneOff: formatCurrency(row.oneOffMinor, row.currency, $locale),
          recurring: formatCurrency(row.recurringMinor, row.currency, $locale),
          total: formatCurrency(row.oneOffMinor + row.recurringMinor, row.currency, $locale),
        }))}
      />
    {:else}
      <EmptyState title={t('supporter.home.noLifetimeTitle', {}, $locale)} description={t('supporter.home.noLifetimeDescription', {}, $locale)} />
    {/if}
  </section>

  {#if memberships.some((membership) => membership.status === 'past_due')}
    <p {...statusAttrs}>
      <Badge>{t('supporter.home.pastDue', {}, $locale)}</Badge>
      {t('supporter.home.gracePeriod', { project: memberships.find((membership) => membership.status === 'past_due')?.projectName ?? '' }, $locale)}
    </p>
  {/if}
</SupporterPageFrame>
