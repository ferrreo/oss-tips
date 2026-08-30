<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterSecurityRow from './SupporterSecurityRow.svelte';
  import type {
    SupporterAccount,
    SupporterOAuthProvider,
  } from './SupporterSettingsPage.svelte';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterConnectionsSectionProps {
    linkedAccounts?: SupporterAccount[];
    oauthProviders?: SupporterOAuthProvider[];
    securityState?: 'ready' | 'loading' | 'error';
    securityError?: string | undefined;
    securityAction?: string | null;
    securityActionError?: string;
    onlinkaccount?: ((providerId: string) => void | Promise<void>) | undefined;
    onunlinkaccount?: ((id: string) => void | Promise<void>) | undefined;
    runSecurityAction: (
      key: string,
      action: (() => void | Promise<void>) | undefined,
    ) => void | Promise<void>;
  }

  let {
    linkedAccounts = [],
    oauthProviders = [],
    securityState = 'ready',
    securityError,
    securityAction = null,
    securityActionError,
    onlinkaccount,
    onunlinkaccount,
    runSecurityAction,
  }: SupporterConnectionsSectionProps = $props();

  const sectionTitleAttrs = stylex.attrs(supporter.sectionTitle);
  const mutedAttrs = stylex.attrs(supporter.muted);
  const statusAttrs = stylex.attrs(supporter.statusLine);
  const securityListAttrs = stylex.attrs(supporter.securityList);

  function dateLabel(value: string, currentLocale: Locale): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t('supporter.settings.invalidDate', {}, currentLocale)
      : formatDate(date, currentLocale);
  }
</script>

<section aria-labelledby="supporter-connections-title">
  <h2 id="supporter-connections-title" {...sectionTitleAttrs}>{t('supporter.settings.connectionsTitle', {}, $locale)}</h2>
  <p {...mutedAttrs}>{t('supporter.settings.connectionsDescription', {}, $locale)}</p>
  {#if securityState === 'loading'}
    <p {...statusAttrs} role="status">{t('supporter.settings.loadingConnections', {}, $locale)}</p>
  {:else if securityState === 'error'}
    <p {...statusAttrs} role="alert">{securityError || t('supporter.settings.connectionsError', {}, $locale)}</p>
  {:else if oauthProviders.length === 0}
    <EmptyState title={t('supporter.settings.noProvidersTitle', {}, $locale)} description={t('supporter.settings.noProvidersDescription', {}, $locale)} />
  {:else}
    <ul {...securityListAttrs}>
      {#each oauthProviders as provider, index (provider.id)}
        {@const account = linkedAccounts.find((item) => item.providerId === provider.id)}
        <SupporterSecurityRow
          label={provider.label}
          meta={account ? t('supporter.settings.connectedOn', { date: dateLabel(account.createdAt, $locale) }, $locale) : t('supporter.settings.notConnected', {}, $locale)}
          last={index === oauthProviders.length - 1}
        >
          {#if account}
            <Button
              variant="quiet"
              label={t('supporter.settings.unlink', {}, $locale)}
              aria-label={t('supporter.settings.unlinkAria', { provider: provider.label }, $locale)}
              loading={securityAction === `account:${account.id}`}
              disabled={securityState !== 'ready' || Boolean(securityAction) || linkedAccounts.length < 2 || !onunlinkaccount}
              onclick={() => runSecurityAction(`account:${account.id}`, () => onunlinkaccount?.(account.id))}
            />
          {:else}
            <Button
              variant="secondary"
              label={t('supporter.settings.connect', { provider: provider.label }, $locale)}
              loading={securityAction === `provider:${provider.id}`}
              disabled={securityState !== 'ready' || Boolean(securityAction) || !onlinkaccount}
              onclick={() => runSecurityAction(`provider:${provider.id}`, () => onlinkaccount?.(provider.id))}
            />
          {/if}
        </SupporterSecurityRow>
      {/each}
    </ul>
  {/if}
  {#if securityActionError}
    <p {...statusAttrs} role="alert">{securityActionError}</p>
  {/if}
</section>
