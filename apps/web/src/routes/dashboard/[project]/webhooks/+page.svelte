<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectWebhooksPage from '@oss-tips/ui/pages/project/ProjectWebhooksPage.svelte';
  import type { Props as WebhooksProps } from '@oss-tips/ui/pages/project/ProjectWebhooksPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  async function createEndpoint(input: Parameters<NonNullable<WebhooksProps['onCreateEndpoint']>>[0]) {
    const response = await projectApi<{ secret?: string }>(`/api/v1/project/webhooks?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({
        url: input.url,
        events: input.events.split(',').map((event) => event.trim()).filter(Boolean),
      }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
    return response.secret;
  }
</script>

<ProjectWebhooksPage {...data} onCreateEndpoint={createEndpoint} />
