<script lang="ts">
  import HeroLandscape from './HeroLandscape.svelte';
  import wordmarkLight from '../assets/oss-tips-wordmark-light.svg';
  import wordmarkDark from '../assets/oss-tips-wordmark-dark.svg';

  interface Props {
    theme?: 'light' | 'dark';
  }

  let { theme }: Props = $props();

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

  const wordmark = $derived(resolved === 'dark' ? wordmarkDark : wordmarkLight);
</script>

<footer class="pl-public-footer">
  <HeroLandscape theme={resolved} compact class="pl-public-footer__landscape" />
  <div class="pl-container">
    <div class="pl-public-footer__grid">
      <div>
        <img class="pl-public-footer__wordmark" src={wordmark} alt="oss.tips" width="128" height="28" />
        <p class="pl-display pl-public-footer__strapline">Open source thrives with you.</p>
        <p class="pl-public-footer__lead">
          Direct support for the tools you rely on. Clear fees. No hidden platform balance.
        </p>
      </div>
      <div>
        <strong class="pl-public-footer__heading">Platform</strong>
        <ul class="pl-public-footer__links">
          <li><a href="/about">About</a></li>
          <li><a href="/security">Security</a></li>
          <li><a href="/transparency">Transparency</a></li>
          <li><a href="/terms">Terms</a></li>
        </ul>
      </div>
      <div>
        <strong class="pl-public-footer__heading">Projects</strong>
        <ul class="pl-public-footer__links">
          <li><a href="/explore">Explore</a></li>
          <li><a href="/docs">Documentation</a></li>
          <li><a href="/pricing">How fees work</a></li>
        </ul>
      </div>
    </div>
    <p class="pl-public-footer__legal">
      Secure payments via Stripe. Projects are the merchant of record.
    </p>
  </div>
</footer>
