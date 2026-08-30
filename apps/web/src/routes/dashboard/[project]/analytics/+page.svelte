<script lang="ts">
  import ProjectAnalyticsPage from '@oss-tips/ui/pages/project/ProjectAnalyticsPage.svelte';

  let { data } = $props();
</script>

<ProjectAnalyticsPage {...data} />
