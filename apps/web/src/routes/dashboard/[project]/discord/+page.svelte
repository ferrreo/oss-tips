<script lang="ts">
  import ProjectDiscordPage from '@oss-tips/ui/pages/project/ProjectDiscordPage.svelte';

  let { data } = $props();
</script>

<ProjectDiscordPage {...data} />
