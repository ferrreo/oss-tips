<script lang="ts">
  import ProjectPage from '@oss-tips/ui/pages/public/ProjectPage.svelte';

  let { data } = $props();
</script>

<ProjectPage {...data} />
