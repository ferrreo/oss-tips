<script lang="ts">
  import AnalyticsPage from '@oss-tips/ui/pages/dashboard/AnalyticsPage.svelte';

  let { data } = $props();
</script>

<AnalyticsPage {...data} />
