<script lang="ts">
  import type { Snippet } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicNav from '../../components/PublicNav.svelte';
  import SupporterAccountNav, { type SupporterRoute } from './SupporterAccountNav.svelte';
  import { supporter } from '../../styles/supporter.stylex';
  import { locale, t } from '../../lib/i18n.js';

  export interface SupporterPageFrameProps {
    current: SupporterRoute;
    title: string;
    lede: string;
    reading?: boolean;
    error?: string | undefined;
    children?: Snippet | undefined;
  }

  let { current, title, lede, reading = false, error, children }: SupporterPageFrameProps = $props();

  const pageAttrs = stylex.attrs(supporter.page);
  const containerAttrs = $derived(stylex.attrs([supporter.container, reading && supporter.reading]));
  const headerAttrs = stylex.attrs(supporter.header);
  const eyebrowAttrs = stylex.attrs(supporter.eyebrow);
  const titleAttrs = stylex.attrs(supporter.title);
  const ledeAttrs = stylex.attrs(supporter.lede);
  const errorAttrs = stylex.attrs(supporter.error);
</script>

<div {...pageAttrs}>
  <PublicNav />
  <main id="main-content" aria-labelledby="supporter-page-title">
    <div {...containerAttrs}>
      <header {...headerAttrs}>
        <p {...eyebrowAttrs}>{t('shells.supporterWorkspace', {}, $locale)}</p>
        <h1 id="supporter-page-title" {...titleAttrs}>{title}</h1>
        <p {...ledeAttrs}>{lede}</p>
      </header>
      <SupporterAccountNav {current} />
      {#if error}
        <p {...errorAttrs} role="alert">{error}</p>
      {/if}
      {@render children?.()}
    </div>
  </main>
</div>
