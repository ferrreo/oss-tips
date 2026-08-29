<script lang="ts">
  import InboxPage from '@oss-tips/ui/pages/supporter/InboxPage.svelte';

  let { data } = $props();
</script>

<InboxPage {...data} />
