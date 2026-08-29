<script lang="ts">
  import { page } from '$app/state';
  import ClaimPage from '@oss-tips/ui/pages/public/ClaimPage.svelte';
</script>

<ClaimPage token={page.params.token} />
