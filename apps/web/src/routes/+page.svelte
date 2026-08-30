<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import HomePage from '@oss-tips/ui/pages/public/HomePage.svelte';

  let { data } = $props();
</script>

<SeoHead
  title={t('common.documentTitle', {}, $locale)}
  description={t('home.support', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/')}
/>
<HomePage {...data} />
