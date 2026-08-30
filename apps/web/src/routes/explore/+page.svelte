<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ExplorePage from '@oss-tips/ui/pages/public/ExplorePage.svelte';

  let { data } = $props();
</script>

<SeoHead
  title={t('public.explore.title', {}, $locale)}
  description={t('public.explore.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/explore')}
/>
<ExplorePage {...data} />
