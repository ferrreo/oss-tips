<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import TermsDocPage from '@oss-tips/ui/pages/public/TermsDocPage.svelte';
</script>

<SeoHead
  title={t('public.terms.title', {}, $locale)}
  description={t('public.terms.serviceBody', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/terms/${page.params.doc ?? ''}`)}
/>
<TermsDocPage doc={page.params.doc} />
