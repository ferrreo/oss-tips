<script lang="ts">
  import AdminCasesPage from '@oss-tips/ui/pages/admin/AdminCasesPage.svelte';

  let { data } = $props();
</script>

<AdminCasesPage {...data} />
