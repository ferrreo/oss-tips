<script lang="ts">
  import { page } from '$app/state';
  import TeamPage from '@oss-tips/ui/pages/dashboard/TeamPage.svelte';
</script>

<TeamPage project={page.params.project} />
