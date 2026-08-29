<script lang="ts">
  import ProjectGoalPage from '@oss-tips/ui/pages/public/ProjectGoalPage.svelte';
  import { page } from '$app/state';

  let { data } = $props();
</script>

<ProjectGoalPage {...data} slug={page.params.slug} />
