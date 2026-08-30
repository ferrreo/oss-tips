<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { SupportEmailVerificationResult } from '@oss-tips/ui/components/SupportEmailVerification.svelte';
  import ProjectSettingsPage from '@oss-tips/ui/pages/project/ProjectSettingsPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  const supportEmailVerificationPath = () =>
    `/api/v1/project/support-email/verification?project_slug=${encodeURIComponent(data.project.slug)}`;

  async function sendSupportEmailVerification(email: string): Promise<SupportEmailVerificationResult> {
    const result = await projectApi<SupportEmailVerificationResult>(supportEmailVerificationPath(), {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ action: 'send', email }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
    return result;
  }

  async function confirmSupportEmailVerification(code: string): Promise<SupportEmailVerificationResult> {
    const result = await projectApi<SupportEmailVerificationResult>(supportEmailVerificationPath(), {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ action: 'confirm', code }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
    return result;
  }

  async function saveSettings(input: {
    name: string;
    description: string;
    websiteUrl: string;
    repositoryUrl: string;
    supportEmail: string;
    feeMode: 'standard' | 'project_5pct';
    minSupportMinor: number | null | undefined;
    maxSupportMinor: number | null | undefined;
    showGatedPostMetadata: boolean;
  }) {
    const repository = input.repositoryUrl
      ? (() => {
          const url = new URL(input.repositoryUrl);
          return {
            provider: url.hostname.split('.')[0] || 'git',
            external_id: url.pathname.replace(/^\/+|\/+$/g, ''),
            url: url.toString(),
          };
        })()
      : null;
    await projectApi('/api/v1/project?project_slug=' + encodeURIComponent(data.project.slug), {
      method: 'PUT',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        website_url: input.websiteUrl || null,
        support_email: input.supportEmail || null,
        repository,
        feature_mode: input.feeMode === 'project_5pct' ? 'contributes_5_percent' : 'standard',
        public_display: { show_gated_post_metadata: input.showGatedPostMetadata },
        ...(input.minSupportMinor === undefined
          ? {}
          : {
              min_support:
                input.minSupportMinor === null
                  ? null
                  : {
                      amount: String(input.minSupportMinor),
                      currency: data.project.currency.toLowerCase(),
                    },
            }),
        ...(input.maxSupportMinor === undefined
          ? {}
          : {
              max_support:
                input.maxSupportMinor === null
                  ? null
                  : {
                      amount: String(input.maxSupportMinor),
                      currency: data.project.currency.toLowerCase(),
                    },
            }),
      }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }

  async function closeProject() {
    await projectApi(
      `/api/v1/project?project_slug=${encodeURIComponent(data.project.slug)}`,
      {
        method: 'DELETE',
        headers: { 'x-project-slug': data.project.slug },
        body: JSON.stringify({ confirm: true }),
      },
      t('project.lifecycle.actionError', {}, $locale),
    );
    await invalidateAll();
  }
</script>

<ProjectSettingsPage
  {...data}
  onSave={saveSettings}
  onSendSupportEmailVerification={sendSupportEmailVerification}
  onConfirmSupportEmailVerification={confirmSupportEmailVerification}
  onCloseProject={closeProject}
/>
