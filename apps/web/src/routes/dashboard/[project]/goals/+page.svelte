<script lang="ts">
  import GoalsPage from '@oss-tips/ui/pages/dashboard/GoalsPage.svelte';

  let { data } = $props();
</script>

<GoalsPage {...data} />
