<script lang="ts">
  import type { ProjectCapability } from '@oss-tips/auth';
  import { invalidateAll } from '$app/navigation';
  import { currencyExponent } from '@oss-tips/domain/money';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectMembershipsPage from '@oss-tips/ui/pages/project/ProjectMembershipsPage.svelte';
  import type { TierCreateInput } from '@oss-tips/ui/pages/project/ProjectMembershipsPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  const canManageTiers = () =>
    data.projectCapabilities?.includes('project.manage_tiers' as ProjectCapability) ?? false;

  async function createTier(input: TierCreateInput) {
    const amount = Number(input.monthlyMajor.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(t('common.positiveAmount', {}, $locale));
    const amountMinor = String(Math.round(amount * 10 ** currencyExponent(data.project.currency)));
    await projectApi(`/api/v1/project/tiers?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify({
        name: input.name,
        rank: Math.min(data.tiers.length, 7),
        description: null,
        minimum_visibility: 'public',
        discord_roles: [],
        one_off_amount: null,
        monthly_amount: { amount: amountMinor, currency: data.project.currency.toLowerCase() },
        annual_amount: { amount: amountMinor, currency: data.project.currency.toLowerCase() },
        benefits: input.rewards.trim() ? [input.rewards.trim()] : [],
      }),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }
</script>

<ProjectMembershipsPage
  {...data}
  {...(canManageTiers() ? { onCreateTier: createTier } : {})}
/>
