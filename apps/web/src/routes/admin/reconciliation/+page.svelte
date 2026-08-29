<script lang="ts">
  import ReconciliationPage from '@oss-tips/ui/pages/admin/ReconciliationPage.svelte';

  let { data } = $props();
</script>

<ReconciliationPage {...data} />
