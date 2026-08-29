<script lang="ts">
  import HomePage from '@oss-tips/ui/pages/public/HomePage.svelte';

  let { data } = $props();
</script>

<HomePage {...data} />
