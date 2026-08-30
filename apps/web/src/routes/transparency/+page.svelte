<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import TransparencyPage from '@oss-tips/ui/pages/public/TransparencyPage.svelte';

  let { data } = $props();
</script>

<SeoHead
  title={t('public.transparency.title', {}, $locale)}
  description={t('public.transparency.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/transparency')}
/>
<TransparencyPage state={data.state} aggregate={data.aggregate} />
