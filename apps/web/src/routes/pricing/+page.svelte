<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import PricingPage from '@oss-tips/ui/pages/public/PricingPage.svelte';
</script>

<SeoHead
  title={t('public.pricing.title', {}, $locale)}
  description={t('public.pricing.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/pricing')}
/>
<PricingPage />
