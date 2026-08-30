<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import { currencyExponent } from '@oss-tips/domain/money';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { Membership } from '../../fixtures/demo.js';
  import { formatCadence, formatCurrency, formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import {
    platformTipMinor as defaultPlatformTipMinor,
    supporterMemberships as defaultMemberships,
  } from './supporter-demo.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterMembershipsPageProps {
    source?: 'demo' | 'db';
    memberships?: Membership[];
    platformTipMinor?: number;
    platformTipMembershipId?: string | null;
    error?: string | undefined;
    portalState?: 'idle' | 'loading' | 'success' | 'error';
    portalProjectSlug?: string;
    portalError?: string;
    onmanagebilling?: (projectSlug: string) => void | Promise<void>;
    cancelState?: 'idle' | 'loading' | 'success' | 'error';
    cancelMembershipId?: string;
    cancelError?: string;
    oncancel?: (membershipId: string) => void | Promise<void>;
    tipState?: 'idle' | 'loading' | 'success' | 'error';
    tipMembershipId?: string;
    tipError?: string;
    onupdatetip?: (membershipId: string, amountMinor: number) => void | Promise<void>;
  }

  let {
    memberships = defaultMemberships,
    platformTipMinor = defaultPlatformTipMinor,
    platformTipMembershipId = null,
    error,
    portalState = 'idle',
    portalProjectSlug = '',
    portalError = '',
    onmanagebilling,
    cancelState = 'idle',
    cancelMembershipId = '',
    cancelError = '',
    oncancel,
    tipState = 'idle',
    tipMembershipId = '',
    tipError = '',
    onupdatetip,
  }: SupporterMembershipsPageProps = $props();

  const active = $derived(memberships.filter((membership) => membership.status === 'active'));
  const pastDue = $derived(memberships.filter((membership) => membership.status === 'past_due'));
  const cancelled = $derived(memberships.filter((membership) => membership.status === 'cancelled'));
  const activeCurrencies = $derived(new Set(active.map((membership) => membership.currency.toUpperCase())));
  const monthlyActiveMinor = $derived(
    active.length === 0 || activeCurrencies.size > 1
      ? undefined
      : active.reduce(
          (sum, membership) =>
            sum + (membership.cadence === 'annual' ? Math.round(membership.amountMinor / 12) : membership.amountMinor),
          0,
        ),
  );
  const editableTipMembership = $derived(
    memberships.find(
      (membership) =>
        membership.id === platformTipMembershipId &&
        membership.status === 'active' &&
        (membership.cadence === 'monthly' || membership.cadence === 'annual'),
    ) ??
      memberships.find(
        (membership) =>
          membership.status === 'active' &&
          (membership.cadence === 'monthly' || membership.cadence === 'annual'),
      ),
  );
  const editableTipMembershipId = $derived(editableTipMembership?.id ?? '');
  const platformTipCadence = $derived(
    formatCadence(editableTipMembership?.cadence ?? 'monthly', $locale),
  );
  const summaryCurrency = $derived(active[0]?.currency ?? memberships[0]?.currency ?? 'GBP');
  const currency = $derived(editableTipMembership?.currency ?? summaryCurrency);
  const summaryAttrs = stylex.attrs(supporter.summaryGrid);
  const surfaceAttrs = stylex.attrs(supporter.surface);
  const surfaceTitleAttrs = stylex.attrs(supporter.surfaceTitle);
  const actionsAttrs = stylex.attrs(supporter.actions);
  const formAttrs = stylex.attrs(supporter.form);
  const rowBetweenAttrs = stylex.attrs(supporter.rowBetween);
  const statusAttrs = stylex.attrs(supporter.statusLine);
  const mutedAttrs = stylex.attrs(supporter.muted);
  const billableMemberships = $derived(memberships.filter((membership) => membership.status !== 'cancelled'));
  let tipAmount = $state(untrack(() => formatTipAmount(platformTipMinor, currency)));
  let tipInputBase = $state(untrack(() => `${platformTipMinor}:${currency}`));
  let tipInputError = $state('');
  const tipInputKey = $derived(`${platformTipMinor}:${currency}`);
  const monthlyEquivalent = $derived(
    activeCurrencies.size > 1
      ? t('supporter.memberships.multipleCurrencies', {}, $locale)
      : monthlyActiveMinor === undefined
        ? t('common.notAvailable', {}, $locale)
        : t('supporter.memberships.monthlyEquivalent', { amount: formatCurrency(monthlyActiveMinor, summaryCurrency, $locale) }, $locale),
  );

  $effect(() => {
    if (tipInputBase === tipInputKey) return;
    tipAmount = formatTipAmount(platformTipMinor, currency);
    tipInputBase = tipInputKey;
    tipInputError = '';
  });

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

  function dateLabel(value: string, currentLocale: Locale): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('common.notAvailable', {}, currentLocale) : formatDate(date, currentLocale);
  }

  async function cancelMembership(membership: Membership): Promise<void> {
    if (!oncancel || cancelState === 'loading') return;
    if (typeof window !== 'undefined' && !window.confirm(t('supporter.memberships.cancelConfirm', { project: membership.projectName }, $locale))) return;
    await oncancel(membership.id);
  }

  function formatTipAmount(amountMinor: number, currentCurrency: string): string {
    const exponent = currencyExponent(currentCurrency);
    return (amountMinor / 10 ** exponent).toFixed(exponent);
  }

  function parseTipAmount(value: string, currentCurrency: string): number | null {
    const normalized = value.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
    const exponent = currencyExponent(currentCurrency);
    const [whole = '0', fraction = ''] = normalized.split('.');
    if (fraction.length > exponent) return null;
    try {
      const minor =
        BigInt(whole || '0') * 10n ** BigInt(exponent) +
        BigInt(exponent === 0 ? '0' : (fraction || '').padEnd(exponent, '0'));
      return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
    } catch {
      return null;
    }
  }

  async function saveTip(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!onupdatetip || !editableTipMembershipId || tipState === 'loading') return;
    const amountMinor = parseTipAmount(tipAmount, currency);
    if (amountMinor === null) {
      tipInputError = t('supporter.memberships.tipInvalid', {}, $locale);
      return;
    }
    tipInputError = '';
    await onupdatetip(editableTipMembershipId, amountMinor);
  }
</script>

<SupporterPageFrame
  current="memberships"
  title={t('supporter.memberships.title', {}, $locale)}
  lede={t('supporter.memberships.lede', {}, $locale)}
  {error}
>
  <div {...summaryAttrs}>
    <DataCard
      label={t('supporter.memberships.active', {}, $locale)}
      value={String(active.length)}
      compare={monthlyEquivalent}
    />
    <DataCard label={t('supporter.memberships.pastDue', {}, $locale)} value={String(pastDue.length)} compare={t('supporter.memberships.graceOpen', {}, $locale)} compareDirection="down" />
    <DataCard
      label={t('supporter.memberships.platformTip', {}, $locale)}
      value={editableTipMembership
        ? t('supporter.memberships.platformTipPerRenewal', { amount: formatCurrency(platformTipMinor, currency, $locale), cadence: platformTipCadence }, $locale)
        : t('common.notAvailable', {}, $locale)}
      compare={editableTipMembership
        ? t('supporter.memberships.separateTip', {}, $locale)
        : t('common.notAvailable', {}, $locale)}
    />
  </div>

  {#if memberships.length > 0}
    <Table
      caption={t('supporter.memberships.tableCaption', {}, $locale)}
      columns={[
        { key: 'project', label: t('supporter.memberships.project', {}, $locale) },
        { key: 'tier', label: t('supporter.memberships.tier', {}, $locale) },
        { key: 'cadence', label: t('supporter.memberships.cadence', {}, $locale) },
        { key: 'amount', label: t('supporter.memberships.amount', {}, $locale) },
        { key: 'status', label: t('supporter.memberships.status', {}, $locale) },
        { key: 'renews', label: t('supporter.memberships.renewsEnds', {}, $locale) },
      ]}
      rows={memberships.map((membership) => ({
        project: membership.projectName,
        tier: membership.tierName,
        cadence: formatCadence(membership.cadence, $locale),
        amount: formatCurrency(membership.amountMinor, membership.currency, $locale),
        status: membershipStatusLabel(membership.status, $locale),
        renews: dateLabel(membership.renewsAt, $locale),
      }))}
    />
  {:else}
    <EmptyState headingLevel={2} title={t('supporter.memberships.noMembershipsTitle', {}, $locale)} description={t('supporter.memberships.noMembershipsDescription', {}, $locale)} />
  {/if}

  {#if billableMemberships.length > 0}
    <section {...surfaceAttrs} aria-labelledby="billing-title">
      <h2 id="billing-title" {...surfaceTitleAttrs}>{t('supporter.memberships.billingTitle', {}, $locale)}</h2>
      <p>{t('supporter.memberships.billingDescription', {}, $locale)}</p>
      {#if portalState === 'success'}
        <p {...statusAttrs} role="status">{t('supporter.memberships.portalReady', { project: portalProjectSlug }, $locale)}</p>
      {:else if portalState === 'error'}
        <p {...statusAttrs} role="alert">{portalError || t('supporter.memberships.portalError', {}, $locale)}</p>
      {/if}
      {#if cancelState === 'success'}
        <p {...statusAttrs} role="status">{t('supporter.memberships.cancelSuccess', {}, $locale)}</p>
      {:else if cancelState === 'error'}
        <p {...statusAttrs} role="alert">{cancelError || t('supporter.memberships.cancelError', {}, $locale)}</p>
      {/if}
      {#each billableMemberships as membership (membership.id)}
        <div {...rowBetweenAttrs}>
          <div>
            <strong>{membership.projectName}</strong>
            <p {...mutedAttrs}>{membership.tierName} · {formatCadence(membership.cadence, $locale)}</p>
          </div>
          <div {...actionsAttrs}>
            {#if onmanagebilling}
              <Button
                variant="quiet"
                label={t('supporter.memberships.manageBilling', {}, $locale)}
                loading={portalState === 'loading' && portalProjectSlug === membership.projectSlug}
                onclick={() => onmanagebilling?.(membership.projectSlug)}
              />
            {/if}
            {#if oncancel}
              <Button
                variant="destructive"
                label={t('supporter.memberships.cancel', {}, $locale)}
                aria-label={t('supporter.memberships.cancelAria', { project: membership.projectName }, $locale)}
                loading={cancelState === 'loading' && cancelMembershipId === membership.id}
                disabled={cancelState === 'loading'}
                onclick={() => void cancelMembership(membership)}
              />
            {/if}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if editableTipMembership}
    <section {...surfaceAttrs} aria-labelledby="platform-tip-title">
      <h2 id="platform-tip-title" {...surfaceTitleAttrs}>{t('supporter.memberships.platformTipTitle', {}, $locale)}</h2>
      <p>{t('supporter.memberships.platformTipDescription', { amount: formatCurrency(platformTipMinor, currency, $locale) }, $locale)}</p>
      <div {...actionsAttrs}>
        <Badge variant="forest">{t('supporter.memberships.platformTipPerRenewal', { amount: formatCurrency(platformTipMinor, currency, $locale), cadence: platformTipCadence }, $locale)}</Badge>
      </div>
      <form {...formAttrs} onsubmit={saveTip}>
        <TextField
          label={t('supporter.memberships.tipAmount', {}, $locale)}
          type="text"
          inputmode="decimal"
          bind:value={tipAmount}
          help={t('supporter.memberships.tipAmountHelp', {}, $locale)}
          error={tipInputError}
          disabled={!onupdatetip || !editableTipMembershipId || tipState === 'loading'}
          oninput={() => {
            tipInputError = '';
          }}
        />
        <div {...actionsAttrs}>
          <Button
            type="submit"
            label={t('supporter.memberships.saveTip', {}, $locale)}
            loading={tipState === 'loading'}
            disabled={!onupdatetip || !editableTipMembershipId}
          />
        </div>
        {#if tipState === 'success'}
          <p {...statusAttrs} role="status">{t('supporter.memberships.tipSuccess', {}, $locale)}</p>
        {:else if tipState === 'error'}
          <p {...statusAttrs} role="alert">{tipError || t('supporter.memberships.tipError', {}, $locale)}</p>
        {/if}
      </form>
    </section>
  {/if}

  {#each pastDue as membership (membership.id)}
    <p {...statusAttrs}>
      <Badge variant="ochre">{t('supporter.memberships.pastDueBadge', {}, $locale)}</Badge>
      {t('supporter.memberships.pastDueMessage', { project: membership.projectName }, $locale)}
    </p>
  {/each}
  {#each cancelled as membership (membership.id)}
    <p {...statusAttrs}>
      <Badge>{t('supporter.memberships.cancelledBadge', {}, $locale)}</Badge>
      {t('supporter.memberships.cancelledMessage', { project: membership.projectName }, $locale)}
    </p>
  {/each}
</SupporterPageFrame>
