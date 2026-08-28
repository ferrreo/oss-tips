<script lang="ts">
  import Button from './Button.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import wordmarkLight from '../assets/oss-tips-wordmark-light.svg';
  import wordmarkDark from '../assets/oss-tips-wordmark-dark.svg';

  interface Props {
    theme?: 'light' | 'dark';
  }

  let { theme = 'light' }: Props = $props();

  const wordmark = theme === 'dark' ? wordmarkDark : wordmarkLight;
</script>

<header class="pl-public-nav">
  <a href="/" aria-label="oss.tips home">
    <img class="pl-public-nav__wordmark" src={wordmark} alt="oss.tips" />
  </a>
  <nav aria-label="Public navigation">
    <ul class="pl-public-nav__links">
      <li><a href="/explore">Explore</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/docs">Docs</a></li>
      <li><a href="/pricing">How fees work</a></li>
    </ul>
  </nav>
  <div class="pl-row">
    <ThemeToggle />
    <Button variant="secondary">Sign in</Button>
  </div>
</header>
