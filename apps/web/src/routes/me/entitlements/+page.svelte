<script lang="ts">
  import EntitlementsPage from '@oss-tips/ui/pages/supporter/EntitlementsPage.svelte';

  let { data } = $props();
</script>

<EntitlementsPage {...data} />
