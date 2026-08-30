<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import DocsPage from '@oss-tips/ui/pages/public/DocsPage.svelte';
</script>

<SeoHead
  title={t('public.docs.title', {}, $locale)}
  description={t('public.docs.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/docs')}
/>
<DocsPage />
