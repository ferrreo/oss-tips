<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { DomainVerificationState } from '@oss-tips/ui/pages/project/ProjectDomainsPage.svelte';
  import ProjectDomainsPage from '@oss-tips/ui/pages/project/ProjectDomainsPage.svelte';

  let { data } = $props();
  let verificationState = $state<DomainVerificationState>('idle');
  let verificationMessage = $state('');
  let verificationError = $state('');

  async function verifyDomain(hostname: string) {
    verificationState = 'loading';
    verificationMessage = '';
    verificationError = '';
    try {
      const response = await fetch(
        `/api/v1/project/domains?project_slug=${encodeURIComponent(data.project.slug)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-project-slug': data.project.slug },
          credentials: 'same-origin',
          body: JSON.stringify({ hostname }),
        },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(t('project.domains.verificationFailed', {}, $locale));
      }
      const status =
        typeof body === 'object' && body !== null && 'status' in body && typeof body.status === 'string'
          ? body.status
          : 'awaiting_dns';
      verificationState = 'success';
      verificationMessage =
        status === 'active'
          ? t('project.domains.live', { hostname }, $locale)
          : t('project.domains.checkQueuedBody', {}, $locale);
      await invalidateAll();
    } catch {
      verificationState = 'error';
      verificationError = t('project.domains.verificationFailed', {}, $locale);
    }
  }
</script>

<ProjectDomainsPage
  {...data}
  {verificationState}
  {verificationMessage}
  {verificationError}
  onVerify={verifyDomain}
 />
