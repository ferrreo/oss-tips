<script lang="ts">
  import StripePage from '@oss-tips/ui/pages/dashboard/StripePage.svelte';

  let { data } = $props();
</script>

<StripePage {...data} />
