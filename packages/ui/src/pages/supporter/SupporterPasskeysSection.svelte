<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TextField from '../../components/TextField.svelte';
  import { formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterSecurityRow from './SupporterSecurityRow.svelte';
  import type {
    SupporterPasskey,
  } from './SupporterSettingsPage.svelte';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterPasskeysSectionProps {
    passkeys?: SupporterPasskey[];
    securityState?: 'ready' | 'loading' | 'error';
    securityError?: string | undefined;
    securityAction?: string | null;
    onaddpasskey?: ((name: string) => void | Promise<void>) | undefined;
    onremovepasskey?: ((id: string) => void | Promise<void>) | undefined;
    runSecurityAction: (
      key: string,
      action: (() => void | Promise<void>) | undefined,
    ) => void | Promise<void>;
  }

  let {
    passkeys = [],
    securityState = 'ready',
    securityError,
    securityAction = null,
    onaddpasskey,
    onremovepasskey,
    runSecurityAction,
  }: SupporterPasskeysSectionProps = $props();

  let passkeyName = $state('');

  const sectionTitleAttrs = stylex.attrs(supporter.sectionTitle);
  const sectionAttrs = stylex.attrs(supporter.securitySection);
  const mutedAttrs = stylex.attrs(supporter.muted);
  const statusAttrs = stylex.attrs(supporter.statusLine);
  const securityListAttrs = stylex.attrs(supporter.securityList);
  const securityFormAttrs = stylex.attrs(supporter.securityForm);

  function dateLabel(value: string, currentLocale: Locale): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t('supporter.settings.invalidDate', {}, currentLocale)
      : formatDate(date, currentLocale);
  }

  function deviceLabel(value: string, currentLocale: Locale): string {
    return value === 'multiDevice'
      ? t('supporter.settings.syncedDevices', {}, currentLocale)
      : t('supporter.settings.thisDevice', {}, currentLocale);
  }
</script>

<section {...sectionAttrs} aria-labelledby="supporter-passkeys-title">
  <h2 id="supporter-passkeys-title" {...sectionTitleAttrs}>{t('supporter.settings.passkeysTitle', {}, $locale)}</h2>
  <p {...mutedAttrs}>{t('supporter.settings.passkeysDescription', {}, $locale)}</p>
  {#if securityState === 'loading'}
    <p {...statusAttrs} role="status">{t('supporter.settings.loadingPasskeys', {}, $locale)}</p>
  {:else if securityState === 'error'}
    <p {...statusAttrs} role="alert">{securityError || t('supporter.settings.passkeysError', {}, $locale)}</p>
  {:else if passkeys.length === 0}
    <EmptyState title={t('supporter.settings.noPasskeysTitle', {}, $locale)} description={t('supporter.settings.noPasskeysDescription', {}, $locale)} />
  {:else}
    <ul {...securityListAttrs}>
      {#each passkeys as passkey, index (passkey.id)}
        <SupporterSecurityRow
          label={passkey.name}
          meta={`${deviceLabel(passkey.deviceType, $locale)} · ${passkey.lastUsedAt ? t('supporter.settings.lastUsed', { date: dateLabel(passkey.lastUsedAt, $locale) }, $locale) : t('supporter.settings.added', { date: dateLabel(passkey.createdAt, $locale) }, $locale)}${passkey.backedUp ? ` · ${t('supporter.settings.backedUp', {}, $locale)}` : ''}`}
          last={index === passkeys.length - 1}
        >
          <Button
            variant="quiet"
            label={t('supporter.settings.remove', {}, $locale)}
            aria-label={t('supporter.settings.removePasskeyAria', { name: passkey.name }, $locale)}
            loading={securityAction === `passkey:${passkey.id}`}
            disabled={securityState !== 'ready' || Boolean(securityAction)}
            onclick={() => runSecurityAction(`passkey:${passkey.id}`, () => onremovepasskey?.(passkey.id))}
          />
        </SupporterSecurityRow>
      {/each}
    </ul>
  {/if}
  <div {...securityFormAttrs}>
    <TextField
      label={t('supporter.settings.passkeyName', {}, $locale)}
      name="passkey-name"
      bind:value={passkeyName}
      help={t('supporter.settings.passkeyNameHelp', {}, $locale)}
      disabled={securityState !== 'ready' || Boolean(securityAction)}
    />
    <Button
      variant="secondary"
      label={t('supporter.settings.addPasskey', {}, $locale)}
      loading={securityAction === 'passkey:add'}
      disabled={securityState !== 'ready' || Boolean(securityAction) || !onaddpasskey}
      onclick={() => runSecurityAction('passkey:add', async () => {
        await onaddpasskey?.(passkeyName.trim());
        passkeyName = '';
      })}
    />
  </div>
</section>
