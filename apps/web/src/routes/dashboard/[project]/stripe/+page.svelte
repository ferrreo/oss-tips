<script lang="ts">
  import { page } from '$app/state';
  import StripePage from '@oss-tips/ui/pages/dashboard/StripePage.svelte';
</script>

<StripePage project={page.params.project} />
