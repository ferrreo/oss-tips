<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import TeamInvitePage from '@oss-tips/ui/pages/public/TeamInvitePage.svelte';
  import type { TeamInviteActionResult } from '@oss-tips/ui/pages/public/TeamInvitePage.svelte';

  let { data } = $props();
  const inviteId = $derived(page.params.id ?? data.inviteId);

  function failureForStatus(status: number): TeamInviteActionResult {
    if (status === 401) return { ok: false, state: 'signed-out' };
    if (status === 403) return { ok: false, state: 'mismatch' };
    if (status === 404) return { ok: false, state: 'missing' };
    if (status === 409) return { ok: false, state: 'used' };
    if (status === 410) return { ok: false, state: 'expired' };
    return { ok: false, state: 'error' };
  }

  async function acceptInvite(): Promise<TeamInviteActionResult> {
    try {
      const response = await fetch(`/api/v1/project/team/invites/${encodeURIComponent(inviteId)}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (!response.ok) return failureForStatus(response.status);
      const slug = data.invite?.project.slug;
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return { ok: false, state: 'error' };
      }
      window.location.assign(`/dashboard/${encodeURIComponent(slug)}/team`);
      return { ok: true };
    } catch {
      return { ok: false, state: 'error' };
    }
  }
</script>

<SeoHead
  title={data.invite ? t('public.teamInvite.title', { project: data.invite.project.name }, $locale) : t('public.teamInvite.errorTitle', {}, $locale)}
  description={t('public.teamInvite.description', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/invite/${encodeURIComponent(inviteId)}`)}
  noindex
/>
<TeamInvitePage {...data} onAccept={acceptInvite} />
