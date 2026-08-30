<script lang="ts">
  import AdminDirectoryPage from '@oss-tips/ui/pages/admin/AdminDirectoryPage.svelte';

  let { data } = $props();
</script>

<AdminDirectoryPage {...data} />
