<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import TextField from '../../components/TextField.svelte';
  import { locale, t } from '../../lib/i18n.js';
  import SupporterConnectionsSection from './SupporterConnectionsSection.svelte';
  import SupporterPasskeysSection from './SupporterPasskeysSection.svelte';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import SupporterSessionsSection from './SupporterSessionsSection.svelte';
  import { supporterEmail as defaultEmail, supporterName as defaultName } from './supporter-demo.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterSettingsPageProps {
    source?: 'demo' | 'db';
    supporterName?: string;
    supporterEmail?: string;
    initialTheme?: 'light' | 'dark' | 'system';
    initialWallName?: 'public' | 'anonymous';
    initialWallAmount?: 'hidden' | 'shown';
    error?: string | undefined;
    passkeys?: SupporterPasskey[];
    sessions?: SupporterSession[];
    linkedAccounts?: SupporterAccount[];
    oauthProviders?: SupporterOAuthProvider[];
    securityState?: 'ready' | 'loading' | 'error';
    securityError?: string | undefined;
    onsave?: (settings: SupporterSettingsValues) => void | Promise<void>;
    onaddpasskey?: (name: string) => void | Promise<void>;
    onremovepasskey?: (id: string) => void | Promise<void>;
    onrevokesession?: (id: string) => void | Promise<void>;
    onrevokeothersessions?: () => void | Promise<void>;
    onlinkaccount?: (providerId: string) => void | Promise<void>;
    onunlinkaccount?: (id: string) => void | Promise<void>;
    onexportdata?: () => void | Promise<void>;
    ondeleteaccount?: () => void | Promise<void>;
  }

  export interface SupporterSettingsValues {
    displayName: string;
    email: string;
    theme: 'light' | 'dark' | 'system';
    wallName: 'public' | 'anonymous';
    wallAmount: 'hidden' | 'shown';
  }

  export interface SupporterPasskey {
    id: string;
    name: string;
    deviceType: string;
    backedUp: boolean;
    createdAt: string;
    lastUsedAt?: string | null;
  }

  export interface SupporterSession {
    id: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    current: boolean;
  }

  export interface SupporterAccount {
    id: string;
    providerId: string;
    createdAt: string;
  }

  export interface SupporterOAuthProvider {
    id: string;
    label: string;
  }

  let {
    supporterName = defaultName,
    supporterEmail = defaultEmail,
    initialTheme = 'system',
    initialWallName = 'public',
    initialWallAmount = 'hidden',
    error,
    passkeys = [],
    sessions = [],
    linkedAccounts = [],
    oauthProviders = [],
    securityState = 'ready',
    securityError,
    onsave,
    onaddpasskey,
    onremovepasskey,
    onrevokesession,
    onrevokeothersessions,
    onlinkaccount,
    onunlinkaccount,
    onexportdata,
    ondeleteaccount,
  }: SupporterSettingsPageProps = $props();

  function initialSettings() {
    return {
      displayName: supporterName,
      email: supporterEmail,
      theme: initialTheme,
      wallName: initialWallName,
      wallAmount: initialWallAmount,
    };
  }

  let settings = $state(initialSettings());
  let saveState = $state<'idle' | 'loading' | 'saved'>('idle');
  let saveError = $state('');
  let securityAction = $state<string | null>(null);
  let securityActionError = $state('');
  let dataAction = $state<'idle' | 'loading' | 'exported' | 'deleted'>('idle');
  let dataActionError = $state('');
  let preferencesHydrated = $state(false);

  const themeStorageKey = 'oss-tips-theme';
  const wallPreferencesStorageKey = 'oss-tips-supporter-wall-preferences';

  const formAttrs = stylex.attrs(supporter.form);
  const noteAttrs = stylex.attrs(supporter.fieldNote);
  const actionsAttrs = stylex.attrs(supporter.actions);
  const ruleAttrs = stylex.attrs(supporter.rule);
  const sectionTitleAttrs = stylex.attrs(supporter.sectionTitle);
  const mutedAttrs = stylex.attrs(supporter.muted);
  const statusAttrs = stylex.attrs(supporter.statusLine);
  function isTheme(value: unknown): value is SupporterSettingsValues['theme'] {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  function isWallName(value: unknown): value is SupporterSettingsValues['wallName'] {
    return value === 'public' || value === 'anonymous';
  }

  function isWallAmount(value: unknown): value is SupporterSettingsValues['wallAmount'] {
    return value === 'hidden' || value === 'shown';
  }

  function applyThemePreference(preference: SupporterSettingsValues['theme']): void {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.theme = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
  }

  $effect(() => {
    if (preferencesHydrated || typeof window === 'undefined') return;
    preferencesHydrated = true;
    let savedTheme: unknown;
    let savedWall: unknown;
    try {
      savedTheme = localStorage.getItem(themeStorageKey);
      const rawWall = localStorage.getItem(wallPreferencesStorageKey);
      savedWall = rawWall ? JSON.parse(rawWall) : null;
    } catch {
      savedTheme = null;
      savedWall = null;
    }
    const wall = typeof savedWall === 'object' && savedWall !== null ? savedWall as Record<string, unknown> : {};
    if (isTheme(savedTheme) || isWallName(wall.name) || isWallAmount(wall.amount)) {
      settings = {
        ...settings,
        ...(isTheme(savedTheme) ? { theme: savedTheme } : {}),
        ...(isWallName(wall.name) ? { wallName: wall.name } : {}),
        ...(isWallAmount(wall.amount) ? { wallAmount: wall.amount } : {}),
      };
    }
  });

  $effect(() => {
    if (!preferencesHydrated || typeof window === 'undefined') return;
    applyThemePreference(settings.theme);
    try {
      localStorage.setItem(themeStorageKey, settings.theme);
      localStorage.setItem(wallPreferencesStorageKey, JSON.stringify({ name: settings.wallName, amount: settings.wallAmount }));
    } catch {
      // Preferences remain usable for this session when storage is unavailable.
    }
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!onsave || saveState === 'loading') return;
    saveState = 'loading';
    saveError = '';
    try {
      await onsave({ ...settings });
      saveState = 'saved';
    } catch (cause) {
      saveState = 'idle';
      saveError = cause instanceof Error ? cause.message : t('supporter.settings.saveError', {}, $locale);
    }
  }

  async function runSecurityAction(
    key: string,
    action: (() => void | Promise<void>) | undefined,
  ) {
    if (!action || securityAction) return;
    securityAction = key;
    securityActionError = '';
    try {
      await action();
    } catch (cause) {
      securityActionError = cause instanceof Error ? cause.message : t('supporter.settings.securityActionError', {}, $locale);
    } finally {
      securityAction = null;
    }
  }

  async function runDataAction(
    action: 'export' | 'delete',
    callback: (() => void | Promise<void>) | undefined,
  ): Promise<void> {
    if (!callback || dataAction === 'loading') return;
    if (action === 'delete' && typeof window !== 'undefined' && !window.confirm(t('supporter.settings.deleteConfirm', {}, $locale))) return;
    dataAction = 'loading';
    dataActionError = '';
    try {
      await callback();
      dataAction = action === 'export' ? 'exported' : 'deleted';
    } catch (cause) {
      dataAction = 'idle';
      dataActionError = cause instanceof Error ? cause.message : t('supporter.settings.dataActionError', {}, $locale);
    }
  }
</script>

<SupporterPageFrame
  current="settings"
  title={t('supporter.settings.title', {}, $locale)}
  lede={t('supporter.settings.lede', {}, $locale)}
  reading
  {error}
>
  <form {...formAttrs} onsubmit={save}>
    <TextField
      label={t('supporter.settings.displayName', {}, $locale)}
      name="display-name"
      bind:value={settings.displayName}
      help={t('supporter.settings.displayNameHelp', {}, $locale)}
    />
    <TextField
      label={t('supporter.settings.email', {}, $locale)}
      name="account-email"
      type="email"
      bind:value={settings.email}
      help={t('supporter.settings.emailHelp', {}, $locale)}
    />

    <div>
      <SegmentedControl
        label={t('supporter.settings.themePreference', {}, $locale)}
        options={[
          { value: 'light', label: t('supporter.settings.light', {}, $locale) },
          { value: 'dark', label: t('supporter.settings.dark', {}, $locale) },
          { value: 'system', label: t('supporter.settings.system', {}, $locale) },
        ]}
        bind:value={settings.theme}
      />
      <p {...noteAttrs}>{t('supporter.settings.themeNote', {}, $locale)}</p>
    </div>

    <div>
      <SegmentedControl
        label={t('supporter.settings.wallName', {}, $locale)}
        options={[
          { value: 'public', label: t('supporter.settings.showName', {}, $locale) },
          { value: 'anonymous', label: t('supporter.settings.anonymous', {}, $locale) },
        ]}
        bind:value={settings.wallName}
      />
      <p {...noteAttrs}>{t('supporter.settings.wallNameNote', {}, $locale)}</p>
    </div>

    <div>
      <SegmentedControl
        label={t('supporter.settings.wallAmount', {}, $locale)}
        options={[
          { value: 'hidden', label: t('supporter.settings.hideAmount', {}, $locale) },
          { value: 'shown', label: t('supporter.settings.showAmount', {}, $locale) },
        ]}
        bind:value={settings.wallAmount}
      />
      <p {...noteAttrs}>{t('supporter.settings.wallAmountNote', {}, $locale)}</p>
    </div>

    <Button variant="primary" type="submit" label={t('supporter.settings.save', {}, $locale)} loading={saveState === 'loading'} disabled={!onsave} />
    {#if saveError}
      <p {...statusAttrs} role="alert">{saveError}</p>
    {:else if saveState === 'saved'}
      <p {...statusAttrs} role="status">{t('supporter.settings.saved', {}, $locale)}</p>
    {/if}
  </form>

  <hr {...ruleAttrs} />

  <section aria-labelledby="supporter-data-title">
    <h2 id="supporter-data-title" {...sectionTitleAttrs}>{t('supporter.settings.dataTitle', {}, $locale)}</h2>
    <p {...mutedAttrs}>{t('supporter.settings.dataDescription', {}, $locale)}</p>
    {#if onexportdata || ondeleteaccount}
      <div {...actionsAttrs}>
        {#if onexportdata}
          <Button
            variant="secondary"
            label={t('supporter.settings.requestExport', {}, $locale)}
            loading={dataAction === 'loading'}
            disabled={dataAction === 'loading'}
            onclick={() => void runDataAction('export', onexportdata)}
          />
        {/if}
        {#if ondeleteaccount}
          <Button
            variant="destructive"
            label={t('supporter.settings.deleteAccount', {}, $locale)}
            loading={dataAction === 'loading'}
            disabled={dataAction === 'loading'}
            onclick={() => void runDataAction('delete', ondeleteaccount)}
          />
        {/if}
      </div>
    {/if}
    {#if dataActionError}
      <p {...statusAttrs} role="alert">{dataActionError}</p>
    {:else if dataAction === 'exported'}
      <p {...statusAttrs} role="status">{t('supporter.settings.exported', {}, $locale)}</p>
    {/if}
  </section>

  <hr {...ruleAttrs} />

  <SupporterPasskeysSection
    {passkeys}
    {securityState}
    {securityError}
    {securityAction}
    {onaddpasskey}
    {onremovepasskey}
    {runSecurityAction}
  />

  <SupporterSessionsSection
    {sessions}
    {securityState}
    {securityError}
    {securityAction}
    {onrevokesession}
    {onrevokeothersessions}
    {runSecurityAction}
  />

  <SupporterConnectionsSection
    {linkedAccounts}
    {oauthProviders}
    {securityState}
    {securityError}
    {securityAction}
    {securityActionError}
    {onlinkaccount}
    {onunlinkaccount}
    {runSecurityAction}
  />
</SupporterPageFrame>
