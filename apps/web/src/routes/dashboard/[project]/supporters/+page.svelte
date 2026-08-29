<script lang="ts">
  import SupportersPage from '@oss-tips/ui/pages/dashboard/SupportersPage.svelte';

  let { data } = $props();
</script>

<SupportersPage {...data} />
