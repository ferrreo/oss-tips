<script lang="ts">
  import { page } from '$app/state';
  import DomainsPage from '@oss-tips/ui/pages/dashboard/DomainsPage.svelte';
</script>

<DomainsPage project={page.params.project} />
