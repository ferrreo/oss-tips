<script lang="ts">
  import { page } from '$app/state';
  import ExportsPage from '@oss-tips/ui/pages/dashboard/ExportsPage.svelte';
</script>

<ExportsPage project={page.params.project} />
