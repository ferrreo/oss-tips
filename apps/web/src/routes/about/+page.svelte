<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import AboutPage from '@oss-tips/ui/pages/public/AboutPage.svelte';
</script>

<SeoHead
  title={t('about.title', {}, $locale)}
  description={t('about.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/about')}
/>
<AboutPage />
