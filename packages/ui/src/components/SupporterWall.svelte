<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import type { Supporter } from '../fixtures/demo.js';
  import { formatCurrency, locale, t } from '../lib/i18n.js';
  import { funding } from '../styles/funding.stylex.js';

  export interface Props {
    supporters: Supporter[];
    currency?: string;
    showAmounts?: boolean;
  }

  let { supporters, currency = 'GBP', showAmounts = true }: Props = $props();

  const visible = $derived(supporters.filter((s) => s.public));
</script>

<section class={stylex.attrs(funding.wall).class ?? ''} aria-label={t('common.supporterWall', {}, $locale)}>
  <h3 class={stylex.attrs(funding.wallHeading).class ?? ''}><bdi>{t('common.recentSupporters', {}, $locale)}</bdi></h3>
  {#if visible.length > 0}
    <ul class={stylex.attrs(funding.wallList).class ?? ''}>
    {#each visible as supporter (supporter.id)}
      <li class={stylex.attrs(funding.wallChip).class ?? ''}>
        <bdi>
          {supporter.displayName}
          {#if showAmounts && supporter.amountMinor}
            <span class={stylex.attrs(funding.wallAmount).class ?? ''}> · {formatCurrency(supporter.amountMinor, currency, $locale)}</span>
          {/if}
        </bdi>
        {#if supporter.message}
          <span class={stylex.attrs(funding.wallMessage).class ?? ''}><bdi>{supporter.message}</bdi></span>
        {/if}
      </li>
    {/each}
    </ul>
  {:else}
    <p class={stylex.attrs(funding.wallPrivate).class ?? ''}><bdi>{t('common.noPublicSupporters', {}, $locale)}</bdi></p>
  {/if}
  {#if visible.length < supporters.length}
    <p class={stylex.attrs(funding.wallPrivate).class ?? ''}>
      <bdi>{t('common.supportersPrivate', { count: supporters.length - visible.length }, $locale)}</bdi>
    </p>
  {/if}
</section>
