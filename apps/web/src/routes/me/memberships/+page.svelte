<script lang="ts">
  import MembershipsPage from '@oss-tips/ui/pages/supporter/MembershipsPage.svelte';

  let { data } = $props();
</script>

<MembershipsPage {...data} />
