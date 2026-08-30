<script lang="ts">
  import type { ProjectCapability } from '@oss-tips/auth';
  import { invalidateAll } from '$app/navigation';
  import { currencyExponent } from '@oss-tips/domain/money';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectGoalsPage from '@oss-tips/ui/pages/project/ProjectGoalsPage.svelte';
  import type { GoalCreateInput } from '@oss-tips/ui/pages/project/ProjectGoalsPage.svelte';
  import { projectApi } from '$lib/project-api';

  let { data } = $props();

  const canManageGoals = () =>
    data.projectCapabilities?.includes('project.manage_goals' as ProjectCapability) ?? false;

  async function createGoal(input: GoalCreateInput) {
    const amount = Number(input.targetMajor.replace(',', '.'));
    const isCount = input.basis === 'active supporters';
    if (!Number.isFinite(amount) || amount <= 0 || (isCount && !Number.isInteger(amount)))
      throw new Error(t('common.positiveAmount', {}, $locale));
    const payload = isCount
      ? {
          title: input.title,
          goal_type: 'active_supporter_count',
          target_count: amount,
          basis: input.basis,
          deadline: input.deadline ? `${input.deadline}T00:00:00.000Z` : null,
          status: 'published',
        }
      : {
          title: input.title,
          goal_type: 'one_time_money',
          target_minor: Math.round(amount * 10 ** currencyExponent(data.project.currency)),
          currency: data.project.currency.toLowerCase(),
          basis: input.basis,
          deadline: input.deadline ? `${input.deadline}T00:00:00.000Z` : null,
          status: 'published',
        };
    await projectApi(`/api/v1/project/goals?project_slug=${encodeURIComponent(data.project.slug)}`, {
      method: 'POST',
      headers: { 'x-project-slug': data.project.slug },
      body: JSON.stringify(payload),
    }, t('common.actionFailed', {}, $locale));
    await invalidateAll();
  }
</script>

<ProjectGoalsPage
  {...data}
  {...(canManageGoals() ? { onCreateGoal: createGoal } : {})}
/>
