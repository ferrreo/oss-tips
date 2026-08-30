<script lang="ts">
  import AdminReconciliationPage from '@oss-tips/ui/pages/admin/AdminReconciliationPage.svelte';

  let { data } = $props();
</script>

<AdminReconciliationPage {...data} />
