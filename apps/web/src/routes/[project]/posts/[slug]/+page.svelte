<script lang="ts">
  import { page } from '$app/state';
  import ProjectPostPage from '@oss-tips/ui/pages/public/ProjectPostPage.svelte';
</script>

<ProjectPostPage project={page.params.project} slug={page.params.slug} />
