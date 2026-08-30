<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectPaymentsPage from '@oss-tips/ui/pages/project/ProjectPaymentsPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  async function exportPayments() {
    await projectApi(`/api/v1/project/exports?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ kind: 'payments', format: 'csv' }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }
</script>

<ProjectPaymentsPage {...data} onExport={exportPayments} />
