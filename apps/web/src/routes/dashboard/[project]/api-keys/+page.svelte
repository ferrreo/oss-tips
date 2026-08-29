<script lang="ts">
  import { page } from '$app/state';
  import ApiKeysPage from '@oss-tips/ui/pages/dashboard/ApiKeysPage.svelte';
</script>

<ApiKeysPage project={page.params.project} />
