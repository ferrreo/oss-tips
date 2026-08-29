<script lang="ts">
  import TeamPage from '@oss-tips/ui/pages/dashboard/TeamPage.svelte';

  let { data } = $props();
</script>

<TeamPage {...data} />
