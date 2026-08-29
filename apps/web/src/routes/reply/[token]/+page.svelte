<script lang="ts">
  import { page } from '$app/state';
  import ReplyPage from '@oss-tips/ui/pages/public/ReplyPage.svelte';
</script>

<ReplyPage token={page.params.token} />
