<script lang="ts">
  import { page } from '$app/state';
  import SupportersPage from '@oss-tips/ui/pages/dashboard/SupportersPage.svelte';
</script>

<SupportersPage project={page.params.project} />
