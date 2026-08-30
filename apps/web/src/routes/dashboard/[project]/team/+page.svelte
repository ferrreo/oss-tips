<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectTeamPage from '@oss-tips/ui/pages/project/ProjectTeamPage.svelte';
  import type { Props as TeamProps } from '@oss-tips/ui/pages/project/ProjectTeamPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  async function inviteMember(input: Parameters<NonNullable<TeamProps['onInvite']>>[0]) {
    await projectApi(`/api/v1/project/team?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ email: input.email, role: input.role, capabilities: [] }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }

  async function transferOwnership(email: string) {
    await projectApi(
      `/api/v1/project/ownership/transfer?project_slug=${encodeURIComponent(data.project.slug)}`,
      {
        method: 'POST',
        headers: { 'x-project-slug': data.project.slug },
        body: JSON.stringify({ email }),
      },
      t('project.lifecycle.actionError', {}, $locale),
    );
    await invalidateAll();
  }
</script>

<ProjectTeamPage {...data} onInvite={inviteMember} onTransferOwnership={transferOwnership} />
