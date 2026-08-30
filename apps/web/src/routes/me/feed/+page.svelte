<script lang="ts">
  import SupporterFeedPage from '@oss-tips/ui/pages/supporter/SupporterFeedPage.svelte';

  let { data } = $props();
</script>

<SupporterFeedPage
  posts={data.feed}
  status={data.feedError ? 'error' : 'ready'}
/>
