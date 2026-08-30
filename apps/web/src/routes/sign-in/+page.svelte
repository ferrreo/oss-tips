<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import SignInPage from '@oss-tips/ui/pages/public/SignInPage.svelte';
  import type { SignInActionResult } from '@oss-tips/ui/pages/public/SignInPage.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type AuthResponse =
    | { ok: true; data: Record<string, unknown> }
    | { ok: false; message: string };

  function safeReturnTo(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return '/';
    return value;
  }

  const returnTo = safeReturnTo(page.url.searchParams.get('returnTo'));
  const errorCallbackURL = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  async function postAuth(path: string, body: Record<string, unknown>, fallback: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, message: fallback };
      }
      return { ok: true, data: typeof data === 'object' && data !== null ? data as Record<string, unknown> : {} };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }

  async function requestCode(email: string): Promise<SignInActionResult> {
    const result = await postAuth(
      '/email-otp/send-verification-otp',
      { email, type: 'sign-in' },
      t('auth.sendFailed', {}, $locale),
    );
    return result.ok ? { ok: true } : result;
  }

  async function verifyCode(credentials: { email: string; otp: string }): Promise<SignInActionResult> {
    const result = await postAuth('/sign-in/email-otp', credentials, t('auth.codeFailed', {}, $locale));
    if (!result.ok) return result;
    window.location.assign(returnTo);
    return { ok: true };
  }

  async function startOAuth(provider: string): Promise<SignInActionResult> {
    const result = await postAuth(
      '/sign-in/social',
      {
        provider,
        callbackURL: returnTo,
        errorCallbackURL,
        disableRedirect: true,
      },
      t('auth.providerFailed', { provider }, $locale),
    );
    if (!result.ok) return result;
    const url = result.data.url;
    if (typeof url !== 'string' || !url) {
      return { ok: false, message: t('auth.providerUrlMissing', {}, $locale) };
    }
    window.location.assign(url);
    return { ok: true };
  }
</script>

<SeoHead
  title={t('auth.title', {}, $locale)}
  description={t('auth.lede', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/sign-in')}
  noindex
/>
<SignInPage
  oauth={data.oauthProviders}
  onRequestCode={requestCode}
  onVerifyCode={verifyCode}
  onOAuth={startOAuth}
/>
