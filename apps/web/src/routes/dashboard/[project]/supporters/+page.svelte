<script lang="ts">
  import ProjectSupportersPage from '@oss-tips/ui/pages/project/ProjectSupportersPage.svelte';

  let { data } = $props();
</script>

<ProjectSupportersPage {...data} />
