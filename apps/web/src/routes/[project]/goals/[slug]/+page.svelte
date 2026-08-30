<script lang="ts">
  import ProjectGoalPage from '@oss-tips/ui/pages/public/ProjectGoalPage.svelte';
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';

  let { data } = $props();
</script>

<SeoHead
  title={data.goal.title}
  description={data.goal.description || data.project.description || t('public.goal.summaryWithoutDeadline', { amount: data.goal.targetMinor, basis: data.goal.basis }, $locale)}
  canonical={canonicalUrl(page.url.origin, `/${data.project.slug}/goals/${data.goal.slug}`)}
/>
<ProjectGoalPage {...data} slug={page.params.slug} />
