<script lang="ts">
  import AuditPage from '@oss-tips/ui/pages/admin/AuditPage.svelte';

  let { data } = $props();
</script>

<AuditPage {...data} />
