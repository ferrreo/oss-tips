<script lang="ts">
  import EditPostPage from '@oss-tips/ui/pages/dashboard/EditPostPage.svelte';
  import { page } from '$app/state';

  let { data } = $props();
</script>

<EditPostPage {...data} id={page.params.id} />
