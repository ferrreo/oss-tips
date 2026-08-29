<script lang="ts">
  import InboxPage from '@oss-tips/ui/pages/dashboard/InboxPage.svelte';

  let { data } = $props();
</script>

<InboxPage {...data} />
