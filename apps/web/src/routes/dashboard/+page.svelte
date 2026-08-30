<script lang="ts">
  import { goto } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectCreatePage from '@oss-tips/ui/pages/project/ProjectCreatePage.svelte';
  import type { ProjectCreateInput } from '@oss-tips/ui/pages/project/ProjectCreatePage.svelte';

  async function createProject(input: ProjectCreateInput) {
    const response = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: input.name,
        slug: input.slug,
        description: input.description,
        website_url: input.websiteUrl,
        support_email: input.supportEmail,
        repository_url: input.repositoryUrl,
        open_source_declared: input.openSourceDeclared,
        ...(input.openSourceLicense !== undefined ? { open_source_license: input.openSourceLicense } : {}),
        default_currency: input.defaultCurrency,
        ...(input.organisationName ? { organisation_name: input.organisationName } : {}),
        discovery: {
          ecosystems: input.ecosystems,
          languages: input.languages,
          tags: input.tags,
        },
      }),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(t('dashboard.projectCreate.apiError', {}, $locale));
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('slug' in payload) ||
      typeof payload.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)
    ) {
      throw new Error(t('dashboard.projectCreate.apiError', {}, $locale));
    }
    await goto(`/dashboard/${encodeURIComponent(payload.slug)}/onboarding`);
  }
</script>

<ProjectCreatePage onCreate={createProject} />
