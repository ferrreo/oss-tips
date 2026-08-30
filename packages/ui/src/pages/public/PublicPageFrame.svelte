<script lang="ts">
  import type { Snippet } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import PublicNav from '../../components/PublicNav.svelte';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    children?: Snippet;
    mainClass?: string;
    mainId?: string;
  }

  let { children, mainClass = '', mainId = 'main-content' }: Props = $props();

  const pageClass = stylex.attrs(publicStyles.page).class ?? '';
  const mainClassName = stylex.attrs(publicStyles.main).class ?? '';
</script>

<div class={pageClass}>
  <PublicNav />
  <main id={mainId} class={`${mainClassName} ${mainClass}`.trim()}>
    {#if children}
      {@render children()}
    {/if}
  </main>
  <PublicFooter />
</div>
