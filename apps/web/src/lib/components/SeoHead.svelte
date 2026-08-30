<script lang="ts">
  import { canonicalUrl } from '$lib/seo';

  interface Props {
    title: string;
    description: string;
    canonical: string;
    noindex?: boolean;
  }

  let { title, description, canonical, noindex = false }: Props = $props();
  const image = $derived(canonicalUrl(canonical, '/og-default.png'));
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="oss.tips" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={image} />
  <meta name="twitter:card" content="summary" />
  {#if noindex}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>
