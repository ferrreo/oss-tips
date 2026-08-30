<script lang="ts">
  import Button from './Button.svelte';
  import type { Snippet } from 'svelte';
  import { attrs, display } from '../styles/display.stylex.js';

  export interface Props {
    title: string;
    description?: string;
    actionLabel?: string;
    onaction?: () => void;
    headingLevel?: 2 | 3;
    children?: Snippet;
  }

  let { title, description, actionLabel, onaction, headingLevel = 3, children }: Props = $props();
  const headingTag = $derived(headingLevel === 2 ? 'h2' : 'h3');

  const emptyAttrs = attrs(display.empty);
  const iconAttrs = attrs(display.emptyIcon);
  const circleAttrs = attrs(display.emptyIconCircle);
  const pathAttrs = attrs(display.emptyIconPath);
  const titleAttrs = attrs(display.emptyTitle);
  const textAttrs = attrs(display.emptyText);

  function invokeAction() {
    onaction?.();
  }
</script>

<div class={emptyAttrs.class} style={emptyAttrs.style}>
  <svg class={iconAttrs.class} style={iconAttrs.style} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path {...pathAttrs} d="M8 32 L16 24 L24 28 L40 12" />
    <circle {...circleAttrs} cx="24" cy="24" r="20" fill="none" />
  </svg>
  <svelte:element this={headingTag} class={titleAttrs.class} style={titleAttrs.style}>{title}</svelte:element>
  {#if description}
    <p class={textAttrs.class} style={textAttrs.style}>{description}</p>
  {/if}
  {#if actionLabel}
    <Button variant="primary" onclick={invokeAction}>{actionLabel}</Button>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>
