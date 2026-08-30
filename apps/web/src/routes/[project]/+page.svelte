<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { recordPublicAnalyticsEvent } from '$lib/project-api';
  import { canonicalUrl } from '$lib/seo';
  import ProjectPage from '@oss-tips/ui/pages/public/ProjectPage.svelte';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { SupportCheckoutRequest } from '@oss-tips/ui/components/SupportComposer.svelte';

  let { data } = $props();
  let checkoutLoading = $state(false);
  let checkoutError = $state('');

  onMount(() => {
    if (data.source !== 'db') return;
    const slug = page.params.project ?? data.project.slug;
    void recordPublicAnalyticsEvent(slug, 'page_view').catch(() => undefined);
    void recordPublicAnalyticsEvent(slug, 'support_composer_open').catch(() => undefined);
  });

  async function startCheckout(request: SupportCheckoutRequest) {
    if (checkoutLoading) return;
    checkoutLoading = true;
    checkoutError = '';
    try {
      const { createProjectCheckout } = await import('$lib/checkout');
      const checkoutUrl = await createProjectCheckout(
        page.params.project ?? data.project.slug,
        request,
        fetch,
        t('public.support.checkoutError', {}, $locale),
      );
      window.location.assign(checkoutUrl);
    } catch {
      checkoutError = t('public.support.checkoutError', {}, $locale);
    } finally {
      checkoutLoading = false;
    }
  }
</script>

<SeoHead
  title={data.project.name}
  description={data.project.description || t('home.support', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/${data.project.slug}`)}
/>
<ProjectPage
  {...data}
  goal={data.goals[0] ?? null}
  {checkoutLoading}
  checkoutError={checkoutError}
  oncontinue={startCheckout}
/>
