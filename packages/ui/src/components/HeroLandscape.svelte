<script lang="ts">
  import lightUrl from '../../static/hero-landscape-light.svg';
  import darkUrl from '../../static/hero-landscape-dark.svg';

  interface Props {
    theme?: 'light' | 'dark';
    compact?: boolean;
    class?: string;
  }

  let { theme, compact = false, class: className = '' }: Props = $props();

  let resolved = $state<'light' | 'dark'>(theme ?? 'light');

  $effect(() => {
    if (theme) {
      resolved = theme;
      return;
    }
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => {
      resolved = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
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
