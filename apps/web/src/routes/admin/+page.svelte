<script lang="ts">
  import AdminOverviewPage from '@oss-tips/ui/pages/admin/AdminOverviewPage.svelte';

  let { data } = $props();
</script>

<AdminOverviewPage {...data} />
