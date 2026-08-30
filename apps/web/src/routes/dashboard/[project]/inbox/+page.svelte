<script lang="ts">
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectInboxPage from '@oss-tips/ui/pages/project/ProjectInboxPage.svelte';
  import type { ThreadActionResult } from '@oss-tips/ui/components/ThreadView.svelte';

  let { data } = $props();

  async function responseResult(response: Response, fallback: string): Promise<ThreadActionResult> {
    await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, message: fallback };
    }
    return { ok: true };
  }

  async function sendReply(input: { threadId: string; body?: string }): Promise<ThreadActionResult> {
    try {
      const response = await fetch(`/api/v1/project/threads/${encodeURIComponent(input.threadId)}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-project-slug': data.project.slug,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ body: input.body ?? '' }),
      });
      return responseResult(response, t('common.replyFailed', {}, $locale));
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }

  async function moderate(input: { threadId: string; reason?: string }): Promise<ThreadActionResult> {
    try {
      const response = await fetch(`/api/v1/project/threads/${encodeURIComponent(input.threadId)}/actions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-project-slug': data.project.slug,
        },
        credentials: 'same-origin',
        body: JSON.stringify(input.reason ? { action: 'report', reason: input.reason } : { action: 'block' }),
      });
      return responseResult(
        response,
        t(input.reason ? 'common.reportFailed' : 'common.blockFailed', {}, $locale),
      );
    } catch {
      return { ok: false, message: t('common.networkError', {}, $locale) };
    }
  }
</script>

<ProjectInboxPage {...data} onSendReply={sendReply} onBlockThread={moderate} onReportThread={moderate} />
