<script lang="ts">
  import { page } from '$app/state';
  import OverviewPage from '@oss-tips/ui/pages/dashboard/OverviewPage.svelte';
</script>

<OverviewPage project={page.params.project} />
