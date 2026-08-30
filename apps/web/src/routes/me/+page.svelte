<script lang="ts">
  import SupporterHomePage from '@oss-tips/ui/pages/supporter/SupporterHomePage.svelte';

  let { data } = $props();
</script>

<SupporterHomePage {...data} />
