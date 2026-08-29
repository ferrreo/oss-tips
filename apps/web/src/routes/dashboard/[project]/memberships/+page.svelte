<script lang="ts">
  import MembershipsPage from '@oss-tips/ui/pages/dashboard/MembershipsPage.svelte';

  let { data } = $props();
</script>

<MembershipsPage {...data} />
