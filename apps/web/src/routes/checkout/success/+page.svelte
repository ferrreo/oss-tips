<script lang="ts">
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import CheckoutSuccessPage from '@oss-tips/ui/pages/public/CheckoutSuccessPage.svelte';

  let { data } = $props();
</script>

<SeoHead
  title={t('public.checkout.confirming', {}, $locale)}
  description={t('public.checkout.stripeConfirming', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, '/checkout/success')}
  noindex
/>
<CheckoutSuccessPage {...data} />
