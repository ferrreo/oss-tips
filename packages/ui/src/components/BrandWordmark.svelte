<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { visuals } from '../styles/visuals.stylex.js';
  import markDark from '../assets/oss-tips-mark-dark.svg';
  import markLight from '../assets/oss-tips-mark-light.svg';
  import wordmarkDark from '../assets/oss-tips-wordmark-dark.svg';
  import wordmarkLight from '../assets/oss-tips-wordmark-light.svg';

  export interface Props {
    alt?: string;
    class?: string;
    decorative?: boolean;
    size?: 'default' | 'compact' | 'large';
    theme?: 'light' | 'dark';
    variant?: 'wordmark' | 'mark';
  }

  let {
    alt = 'oss.tips',
    class: className = '',
    decorative = false,
    size = 'default',
    theme,
    variant = 'wordmark',
  }: Props = $props();

  let observedTheme = $state<'light' | 'dark'>('light');
  const resolvedTheme = $derived(theme ?? observedTheme);

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
    `${stylex.attrs(
      visuals.wordmark,
      size === 'compact' && visuals.wordmarkCompact,
      size === 'large' && visuals.wordmarkLarge,
    ).class ?? ''} ${className}`.trim(),
  );
</script>

<span class={rootClass} aria-hidden={decorative ? 'true' : undefined} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : alt}>
  <picture data-theme={resolvedTheme}>
    <img
      class={stylex.attrs(visuals.wordmarkImage).class}
      src={
        variant === 'mark'
          ? resolvedTheme === 'dark'
            ? markDark
            : markLight
          : resolvedTheme === 'dark'
            ? wordmarkDark
            : wordmarkLight
      }
      alt=""
      width={variant === 'mark' ? '160' : '540'}
      height="160"
      decoding="async"
    />
  </picture>
</span>
