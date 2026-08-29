<script lang="ts">
  import ApiKeysPage from '@oss-tips/ui/pages/dashboard/ApiKeysPage.svelte';

  let { data } = $props();
</script>

<ApiKeysPage {...data} />
