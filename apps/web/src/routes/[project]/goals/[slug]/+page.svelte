<script lang="ts">
  import { page } from '$app/state';
  import ProjectGoalPage from '@oss-tips/ui/pages/public/ProjectGoalPage.svelte';
</script>

<ProjectGoalPage project={page.params.project} slug={page.params.slug} />
