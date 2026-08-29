<script lang="ts">
  import ExplorePage from '@oss-tips/ui/pages/public/ExplorePage.svelte';

  let { data } = $props();
</script>

<ExplorePage {...data} />
