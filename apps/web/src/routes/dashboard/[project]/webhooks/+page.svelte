<script lang="ts">
  import { page } from '$app/state';
  import WebhooksPage from '@oss-tips/ui/pages/dashboard/WebhooksPage.svelte';
</script>

<WebhooksPage project={page.params.project} />
