<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { visuals } from '../styles/visuals.stylex.js';
  import lightWebp from '../../static/hero-landscape-paperlight-light.webp';
  import darkWebp from '../../static/hero-landscape-paperlight-dark.webp';

  export interface Props {
    theme?: 'light' | 'dark';
    compact?: boolean;
    imageUrl?: string;
    bannerAssetId?: string;
    class?: string;
  }

  let {
    theme,
    compact = false,
    imageUrl = '',
    bannerAssetId = '',
    class: className = '',
  }: Props = $props();

  let observedTheme = $state<'light' | 'dark'>('light');
  let resolvedImageUrl = $state('');
  const resolvedTheme = $derived(theme ?? observedTheme);

  $effect(() => {
    resolvedImageUrl = '';
    if (imageUrl.trim() || !bannerAssetId.trim() || typeof fetch === 'undefined') return;
    let cancelled = false;
    fetch(`/api/v1/assets/${encodeURIComponent(bannerAssetId)}?variant=lg`, {
      headers: { accept: 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!cancelled && typeof payload === 'object' && payload !== null && 'url' in payload && typeof payload.url === 'string') {
          resolvedImageUrl = payload.url;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (theme || typeof document === 'undefined') return;
    const root = document.documentElement;
    const media = root.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    const sync = () => {
      observedTheme = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && Boolean(media?.matches)) ? 'dark' : 'light';
    };
    sync();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(sync) : undefined;
    observer?.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    media?.addEventListener?.('change', sync);
    return () => {
      observer?.disconnect();
      media?.removeEventListener?.('change', sync);
    };
  });

  const rootClass = $derived(
    `${stylex.attrs(visuals.heroLandscape, compact && visuals.heroLandscapeCompact).class ?? ''} ${className}`.trim(),
  );
  const imageSource = $derived(imageUrl.trim() || resolvedImageUrl || (resolvedTheme === 'dark' ? darkWebp : lightWebp));
</script>

<div class={rootClass} data-theme={resolvedTheme}>
  <img
    class={stylex.attrs(visuals.heroPicture, visuals.heroImage, compact && visuals.heroImageCompact).class}
    src={imageSource}
    alt=""
    role="presentation"
    width="1983"
    height="793"
    decoding="async"
  />
</div>
