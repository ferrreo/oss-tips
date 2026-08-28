<script lang="ts">
  import { page } from '$app/state';
  import ProjectPage from '@oss-tips/ui/pages/public/ProjectPage.svelte';
</script>

<ProjectPage project={page.params.project} />
