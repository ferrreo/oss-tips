<script lang="ts">
  import DirectoryPage from '@oss-tips/ui/pages/admin/DirectoryPage.svelte';

  let { data } = $props();
</script>

<DirectoryPage {...data} />
