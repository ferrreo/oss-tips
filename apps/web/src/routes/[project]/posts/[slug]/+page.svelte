<script lang="ts">
  import ProjectPostPage from '@oss-tips/ui/pages/public/ProjectPostPage.svelte';
  import { page } from '$app/state';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { canonicalUrl } from '$lib/seo';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';

  let { data } = $props();
</script>

<SeoHead
  title={data.post.title}
  description={data.post.excerpt || data.project.description || t('public.docs.lead', {}, $locale)}
  canonical={canonicalUrl(page.url.origin, `/${data.project.slug}/posts/${data.post.slug}`)}
/>
<ProjectPostPage {...data} slug={page.params.slug} />
