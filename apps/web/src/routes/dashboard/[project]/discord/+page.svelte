<script lang="ts">
  import { page } from '$app/state';
  import DiscordPage from '@oss-tips/ui/pages/dashboard/DiscordPage.svelte';
</script>

<DiscordPage project={page.params.project} />
