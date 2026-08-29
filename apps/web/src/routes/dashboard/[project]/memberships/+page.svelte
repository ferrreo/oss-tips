<script lang="ts">
  import { page } from '$app/state';
  import MembershipsPage from '@oss-tips/ui/pages/dashboard/MembershipsPage.svelte';
</script>

<MembershipsPage project={page.params.project} />
