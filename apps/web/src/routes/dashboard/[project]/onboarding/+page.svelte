<script lang="ts">
  import type { ProjectCapability } from '@oss-tips/auth';
  import { goto, invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { SupportEmailVerificationResult } from '@oss-tips/ui/components/SupportEmailVerification.svelte';
  import ProjectOnboardingPage from '@oss-tips/ui/pages/project/ProjectOnboardingPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  const can = (capability: ProjectCapability) =>
    data.projectCapabilities?.includes(capability) ?? false;

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

  async function verifyOwnership() {
    await projectApi(`/api/v1/project/ownership?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ method: 'repository_file', proof_reference: '.oss-tips-challenge' }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }

  async function startStripe() {
    await goto(`/dashboard/${encodeURIComponent(data.project.slug)}/stripe`);
  }

  async function publishProject() {
    await projectApi(`/api/v1/project/publish?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({ confirm: true }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }
</script>

<ProjectOnboardingPage
  {...data}
  {...(can('project.change_fee_mode') ? {
    onVerifyOwnership: verifyOwnership,
    onSendSupportEmailVerification: sendSupportEmailVerification,
    onConfirmSupportEmailVerification: confirmSupportEmailVerification,
  } : {})}
  {...(can('project.connect_stripe') ? { onStartStripe: startStripe } : {})}
  {...(can('project.publish_project') ? { onPublish: publishProject } : {})}
/>
