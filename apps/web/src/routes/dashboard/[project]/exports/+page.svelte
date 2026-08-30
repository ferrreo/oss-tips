<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectExportsPage from '@oss-tips/ui/pages/project/ProjectExportsPage.svelte';
  import type { Props as ExportsProps } from '@oss-tips/ui/pages/project/ProjectExportsPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  async function requestExport(input: Parameters<NonNullable<ExportsProps['onRequestExport']>>[0]) {
    await projectApi(`/api/v1/project/exports?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify(input),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }
</script>

<ProjectExportsPage {...data} onRequestExport={requestExport} />
