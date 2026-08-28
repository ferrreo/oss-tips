<script lang="ts">
  import { page } from '$app/state';
  import GoalsPage from '@oss-tips/ui/pages/dashboard/GoalsPage.svelte';
</script>

<GoalsPage project={page.params.project} />
