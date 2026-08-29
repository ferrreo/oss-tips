<script lang="ts">
  const lightUrl = new URL('../../static/hero-landscape-light.svg', import.meta.url).href;
  const darkUrl = new URL('../../static/hero-landscape-dark.svg', import.meta.url).href;

  interface Props {
    theme?: 'light' | 'dark';
    compact?: boolean;
    class?: string;
  }

  let { theme, compact = false, class: className = '' }: Props = $props();

  let observed = $state<'light' | 'dark'>('light');
  const resolved = $derived(theme ?? observed);

  $effect(() => {
    if (theme) return;
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => {
      observed = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  const src = $derived(resolved === 'dark' ? darkUrl : lightUrl);
</script>

<div
  class="pl-hero-landscape {compact ? 'pl-hero-landscape--compact' : ''} {className}"
  data-theme={resolved}
>
  <img
    class="pl-hero-landscape__image"
    src={src}
    alt=""
    role="presentation"
    width="1600"
    height="420"
  />
</div>
