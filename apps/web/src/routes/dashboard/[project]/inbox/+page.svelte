<script lang="ts">
  import { page } from '$app/state';
  import InboxPage from '@oss-tips/ui/pages/dashboard/InboxPage.svelte';
</script>

<InboxPage project={page.params.project} />
