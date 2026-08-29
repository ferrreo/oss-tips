<script lang="ts">
  import OverviewPage from '@oss-tips/ui/pages/dashboard/OverviewPage.svelte';

  let { data } = $props();
</script>

<OverviewPage {...data} />
