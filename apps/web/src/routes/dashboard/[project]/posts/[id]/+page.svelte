<script lang="ts">
  import { page } from '$app/state';
  import EditPostPage from '@oss-tips/ui/pages/dashboard/EditPostPage.svelte';
</script>

<EditPostPage project={page.params.project} id={page.params.id} />
