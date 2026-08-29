<script lang="ts">
  import CasesPage from '@oss-tips/ui/pages/admin/CasesPage.svelte';

  let { data } = $props();
</script>

<CasesPage {...data} />
