<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import GuestReplyPage from '@oss-tips/ui/pages/public/GuestReplyPage.svelte';
  import type { GuestReplyActionResult } from '@oss-tips/ui/pages/public/GuestReplyPage.svelte';
  import type { ThreadActionResult } from '@oss-tips/ui/components/ThreadView.svelte';

  let { data } = $props();
  const routeToken = page.params.token ?? '';

  async function sendReply(input: { token: string; reply: string }): Promise<GuestReplyActionResult> {
    try {
      const response = await fetch(`/reply/${encodeURIComponent(input.token || routeToken)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ body: input.reply }),
      });
      await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, message: t('common.replyFailed', {}, $locale) };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }

  async function moderate(input: { threadId: string; reason?: string }): Promise<ThreadActionResult> {
    try {
      const response = await fetch(`/reply/${encodeURIComponent(routeToken)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(input.reason ? { action: 'report', reason: input.reason } : { action: 'block' }),
      });
      await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          message: t(input.reason ? 'common.reportFailed' : 'common.blockFailed', {}, $locale),
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }
</script>

<SeoHead
  title={t('public.reply.linkTitle', {}, $locale)}
  description={t('public.reply.help', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/reply/${routeToken}`)}
  noindex
/>
<GuestReplyPage {...data} token={routeToken} onSendReply={sendReply} onBlockThread={moderate} onReportThread={moderate} />
