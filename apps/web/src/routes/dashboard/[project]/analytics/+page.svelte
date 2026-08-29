<script lang="ts">
  import { page } from '$app/state';
  import AnalyticsPage from '@oss-tips/ui/pages/dashboard/AnalyticsPage.svelte';
</script>

<AnalyticsPage project={page.params.project} />
