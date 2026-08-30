<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import TermsPage from '@oss-tips/ui/pages/public/TermsPage.svelte';
</script>

<SeoHead
  title={t('public.terms.title', {}, $locale)}
  description={t('public.terms.serviceBody', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/terms')}
/>
<TermsPage />
