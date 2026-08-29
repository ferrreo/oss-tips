<script lang="ts">
  import DiscordPage from '@oss-tips/ui/pages/dashboard/DiscordPage.svelte';

  let { data } = $props();
</script>

<DiscordPage {...data} />
