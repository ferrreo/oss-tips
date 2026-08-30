<script lang="ts">
  import type { Snippet } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterSecurityRowProps {
    label: string;
    meta: string;
    last?: boolean;
    children?: Snippet;
  }

  let { label, meta, last = false, children }: SupporterSecurityRowProps = $props();

  const itemAttrs = $derived(stylex.attrs(last ? supporter.securityItemLast : supporter.securityItem));
  const copyAttrs = stylex.attrs(supporter.securityCopy);
  const labelAttrs = stylex.attrs(supporter.securityLabel);
  const metaAttrs = stylex.attrs(supporter.securityMeta);
</script>

<li {...itemAttrs}>
  <div {...copyAttrs}>
    <strong {...labelAttrs}>{label}</strong>
    <p {...metaAttrs}>{meta}</p>
  </div>
  {@render children?.()}
</li>
