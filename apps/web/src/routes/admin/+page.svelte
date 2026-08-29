<script lang="ts">
  import AdminHomePage from '@oss-tips/ui/pages/admin/AdminHomePage.svelte';

  let { data } = $props();
</script>

<AdminHomePage {...data} />
