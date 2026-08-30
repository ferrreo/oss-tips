<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import GuestClaimPage from '@oss-tips/ui/pages/public/GuestClaimPage.svelte';
  import type { GuestClaimActionResult } from '@oss-tips/ui/pages/public/GuestClaimPage.svelte';

  let { data } = $props();
  const routeToken = page.params.token ?? '';

  async function postGuest(body: Record<string, unknown>): Promise<GuestClaimActionResult> {
    try {
      const response = await fetch(`/claim/${encodeURIComponent(routeToken)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, message: t('public.claim.errorMessage', {}, $locale) };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }

  async function requestCode(input: { token: string; email: string }): Promise<GuestClaimActionResult> {
    const tokenResult = await postGuest({ action: 'request-code', email: input.email });
    if (!tokenResult.ok) return tokenResult;
    try {
      const response = await fetch('/api/auth/email-otp/send-verification-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: input.email, type: 'sign-in' }),
      });
      if (!response.ok) return { ok: false, message: t('auth.sendFailed', {}, $locale) };
      return { ok: true };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }

  async function verifyCode(input: { token: string; email: string; otp: string }): Promise<GuestClaimActionResult> {
    try {
      const response = await fetch('/api/auth/sign-in/email-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: input.email, otp: input.otp }),
      });
      if (!response.ok) return { ok: false, message: t('auth.codeFailed', {}, $locale) };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
    const claimResult = await postGuest({ action: 'claim' });
    if (!claimResult.ok) return claimResult;
    window.location.assign('/me');
    return { ok: true };
  }
</script>

<SeoHead
  title={t('public.claim.title', {}, $locale)}
  description={t('public.claim.confirmedMessage', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/claim/${routeToken}`)}
  noindex
/>
<GuestClaimPage
  {...data}
  token={routeToken}
  onRequestCode={requestCode}
  onVerifyCode={verifyCode}
/>
