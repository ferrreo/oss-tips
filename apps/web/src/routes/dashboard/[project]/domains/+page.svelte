<script lang="ts">
  import DomainsPage from '@oss-tips/ui/pages/dashboard/DomainsPage.svelte';

  let { data } = $props();
</script>

<DomainsPage {...data} />
