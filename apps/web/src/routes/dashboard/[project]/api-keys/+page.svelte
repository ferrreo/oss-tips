<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectApiKeysPage from '@oss-tips/ui/pages/project/ProjectApiKeysPage.svelte';
  import type { Props as ApiKeysProps } from '@oss-tips/ui/pages/project/ProjectApiKeysPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  async function createKey(input: Parameters<NonNullable<ApiKeysProps['onCreateKey']>>[0]) {
    const response = await projectApi<{ secret?: string }>(`/api/v1/project/api-keys?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({
        name: input.name,
        scopes: input.scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
      }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
    return response.secret;
  }
</script>

<ProjectApiKeysPage {...data} onCreateKey={createKey} />
