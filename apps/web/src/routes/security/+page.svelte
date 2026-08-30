<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import SecurityPage from '@oss-tips/ui/pages/public/SecurityPage.svelte';
</script>

<SeoHead
  title={t('public.security.title', {}, $locale)}
  description={t('public.security.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/security')}
/>
<SecurityPage />
