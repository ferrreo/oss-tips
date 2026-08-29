<script lang="ts">
  import Button from './Button.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    actionLabel?: string;
    onaction?: () => void;
    children?: Snippet;
  }

  let { title, description, actionLabel, onaction, children }: Props = $props();
</script>

<div class="pl-empty">
  <svg class="pl-empty__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M8 32 L16 24 L24 28 L40 12" stroke="var(--pl-fern)" stroke-width="2" />
    <circle cx="24" cy="24" r="20" stroke="var(--pl-border)" stroke-width="2" />
  </svg>
  <h3 class="pl-empty__title">{title}</h3>
  {#if description}
    <p class="pl-empty__text">{description}</p>
  {/if}
  {#if actionLabel}
    <Button variant="primary" onclick={onaction}>{actionLabel}</Button>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>
