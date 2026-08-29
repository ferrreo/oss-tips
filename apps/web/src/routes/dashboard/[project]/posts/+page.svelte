<script lang="ts">
  import { page } from '$app/state';
  import PostsPage from '@oss-tips/ui/pages/dashboard/PostsPage.svelte';
</script>

<PostsPage project={page.params.project} />
