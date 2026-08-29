<script lang="ts">
  import ExportsPage from '@oss-tips/ui/pages/dashboard/ExportsPage.svelte';

  let { data } = $props();
</script>

<ExportsPage {...data} />
