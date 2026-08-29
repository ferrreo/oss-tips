<script lang="ts">
  import TextField from './TextField.svelte';
  import Button from './Button.svelte';
  import type { Thread } from '../fixtures/demo.js';

  interface Props {
    thread: Thread;
  }

  let { thread }: Props = $props();

  let reply = $state('');
</script>

<article class="pl-thread">
  <header class="pl-thread__header">
    <div class="pl-row pl-row--between">
      <strong>{thread.subject}</strong>
      <span class="pl-muted" style="font-size: 0.8125rem;">
        {thread.project} · {thread.cadence}
      </span>
    </div>
  </header>
  {#each thread.messages as message (message.id)}
    <div
      class="pl-thread__message {message.internal ? 'pl-thread__message--internal' : 'pl-thread__message--supporter'}"
    >
      <div class="pl-row pl-row--between" style="margin-bottom: 0.5rem;">
        <strong style="font-size: 0.875rem;">{message.author}</strong>
        <time class="pl-muted" style="font-size: 0.75rem;">{message.timestamp}</time>
      </div>
      <p style="margin: 0;">{message.body}</p>
      {#if message.internal}
        <span class="pl-badge pl-badge--ochre" style="margin-top: 0.5rem;">Internal note</span>
      {/if}
    </div>
  {/each}
  <footer style="padding: 1rem 1.25rem;">
    <TextField label="Reply" value={reply} placeholder="Write a message to your supporter…" />
    <div class="pl-row" style="margin-top: 0.75rem;">
      <Button variant="primary">Send reply</Button>
      <Button variant="quiet">Add internal note</Button>
    </div>
  </footer>
</article>
