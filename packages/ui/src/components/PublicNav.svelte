<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';
  import wordmarkLight from '../assets/oss-tips-wordmark-light.svg';
  import wordmarkDark from '../assets/oss-tips-wordmark-dark.svg';

  interface Props {
    theme?: 'light' | 'dark';
  }

  let { theme }: Props = $props();

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

  const wordmark = $derived(resolved === 'dark' ? wordmarkDark : wordmarkLight);
</script>

<a class="pl-skip-link" href="#main-content">Skip to content</a>
<header class="pl-public-nav">
  <a class="pl-public-nav__home pl-focus-ring" href="/" aria-label="oss.tips home">
    <img class="pl-public-nav__wordmark" src={wordmark} alt="oss.tips" width="128" height="28" />
  </a>
  <nav aria-label="Public navigation">
    <ul class="pl-public-nav__links">
      <li><a class="pl-focus-ring" href="/explore">Explore</a></li>
      <li><a class="pl-focus-ring" href="/about">About</a></li>
      <li><a class="pl-focus-ring" href="/docs">Docs</a></li>
      <li><a class="pl-focus-ring" href="/pricing">How fees work</a></li>
    </ul>
  </nav>
  <div class="pl-public-nav__actions">
    <ThemeToggle />
    <a class="pl-btn pl-btn--secondary pl-focus-ring" href="/signin">Sign in</a>
  </div>
</header>
