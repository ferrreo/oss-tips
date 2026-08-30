<script lang="ts">
  import AdminAuditPage from '@oss-tips/ui/pages/admin/AdminAuditPage.svelte';

  let { data } = $props();
</script>

<AdminAuditPage {...data} />
