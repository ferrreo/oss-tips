<script lang="ts">
  import ProjectOverviewPage from '@oss-tips/ui/pages/project/ProjectOverviewPage.svelte';

  let { data } = $props();
</script>

<ProjectOverviewPage {...data} supporters={data.rankings} />
