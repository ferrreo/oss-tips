<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui';
  import SupporterSettingsPage from '@oss-tips/ui/pages/supporter/SupporterSettingsPage.svelte';
  import type { SupporterSettingsValues } from '@oss-tips/ui/pages/supporter/SupporterSettingsPage.svelte';

  let { data } = $props();

  async function runSettingsAction(
    action: string,
    values: Record<string, string> = {},
    fallback: string = t('supporter.settings.securityActionError', {}, $locale),
  ): Promise<void> {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    let response: Response;
    try {
      response = await fetch(`?/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
    } catch {
      throw new Error(t('common.networkError', {}, $locale));
    }
    await response.json().catch(() => null);
    if (!response.ok) throw new Error(fallback);
  }

  async function saveSettings(values: SupporterSettingsValues): Promise<void> {
    await runSettingsAction(
      'saveProfile',
      { displayName: values.displayName, email: values.email },
      t('supporter.settings.saveError', {}, $locale),
    );
    await invalidateAll();
  }

  async function addPasskey(name: string): Promise<void> {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) {
      throw new Error(t('common.passkeysUnsupported', {}, $locale));
    }
    const [{ createAuthClient }, { passkeyClient }] = await Promise.all([
      import('better-auth/client'),
      import('@better-auth/passkey/client'),
    ]);
    const authClient = createAuthClient({
      baseURL: `${window.location.origin}/api/auth`,
      plugins: [passkeyClient()],
    });
    try {
      const result = await authClient.passkey.addPasskey(name ? { name } : undefined);
      if (result.error) throw new Error(t('supporter.settings.passkeysError', {}, $locale));
    } catch {
      throw new Error(t('supporter.settings.passkeysError', {}, $locale));
    }
    await invalidateAll();
  }

  async function removePasskey(id: string): Promise<void> {
    await runSettingsAction('removePasskey', { id });
    await invalidateAll();
  }

  async function revokeSession(id: string): Promise<void> {
    await runSettingsAction('revokeSession', { id });
    await invalidateAll();
  }

  async function revokeOtherSessions(): Promise<void> {
    await runSettingsAction('revokeOtherSessions');
    await invalidateAll();
  }

  async function unlinkAccount(id: string): Promise<void> {
    await runSettingsAction('unlinkAccount', { id });
    await invalidateAll();
  }

  async function exportData(): Promise<void> {
    let response: Response;
    try {
      response = await fetch('/api/v1/me/export', {
        credentials: 'same-origin',
      });
    } catch {
      throw new Error(t('common.networkError', {}, $locale));
    }
    if (!response.ok) throw new Error(t('supporter.settings.dataActionError', {}, $locale));
    if (typeof document === 'undefined') throw new Error(t('supporter.settings.dataActionError', {}, $locale));
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oss-tips-data.json';
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(): Promise<void> {
    let response: Response;
    try {
      response = await fetch('/api/v1/me/account', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch {
      throw new Error(t('common.networkError', {}, $locale));
    }
    await response.json().catch(() => null);
    if (!response.ok) throw new Error(t('supporter.settings.dataActionError', {}, $locale));
    window.location.assign('/sign-in');
  }

  async function linkAccount(provider: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch('/api/auth/link-social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          provider,
          callbackURL: '/me/settings',
          errorCallbackURL: '/me/settings',
          disableRedirect: true,
        }),
      });
    } catch {
      throw new Error(t('common.networkError', {}, $locale));
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(t('supporter.settings.securityActionError', {}, $locale));
    if (typeof payload !== 'object' || payload === null || !('url' in payload) || typeof payload.url !== 'string') {
      throw new Error(t('supporter.settings.securityActionError', {}, $locale));
    }
    let target: URL;
    try {
      target = new URL(payload.url, window.location.origin);
    } catch {
      throw new Error(t('supporter.settings.securityActionError', {}, $locale));
    }
    const localHttp = target.protocol === 'http:' && (target.hostname === 'localhost' || target.hostname === '127.0.0.1');
    if (target.protocol !== 'https:' && !localHttp) {
      throw new Error(t('supporter.settings.securityActionError', {}, $locale));
    }
    window.location.assign(target.toString());
  }
</script>

<SupporterSettingsPage
  {...data}
  securityError={data.securityError ? t('supporter.settings.securityActionError', {}, $locale) : undefined}
  onsave={saveSettings}
  onaddpasskey={addPasskey}
  onremovepasskey={removePasskey}
  onrevokesession={revokeSession}
  onrevokeothersessions={revokeOtherSessions}
  onlinkaccount={linkAccount}
  onunlinkaccount={unlinkAccount}
  onexportdata={exportData}
  ondeleteaccount={deleteAccount}
/>
