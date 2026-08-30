<script lang="ts">
  import ProjectPostsPage from '@oss-tips/ui/pages/project/ProjectPostsPage.svelte';
  import { goto } from '$app/navigation';

  let { data } = $props();
</script>

<ProjectPostsPage {...data} onNewPost={() => void goto(`/dashboard/${data.project.slug}/posts/new`)} />
