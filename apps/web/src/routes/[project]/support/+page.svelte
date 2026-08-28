<script lang="ts">
  import { page } from '$app/state';
  import ProjectSupportPage from '@oss-tips/ui/pages/public/ProjectSupportPage.svelte';
</script>

<ProjectSupportPage project={page.params.project} />
