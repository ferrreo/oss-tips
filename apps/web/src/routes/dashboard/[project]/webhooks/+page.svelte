<script lang="ts">
  import WebhooksPage from '@oss-tips/ui/pages/dashboard/WebhooksPage.svelte';

  let { data } = $props();
</script>

<WebhooksPage {...data} />
