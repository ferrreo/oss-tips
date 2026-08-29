<script lang="ts">
  import { page } from '$app/state';
  import NewPostPage from '@oss-tips/ui/pages/dashboard/NewPostPage.svelte';
</script>

<NewPostPage project={page.params.project} />
