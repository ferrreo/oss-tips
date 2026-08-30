<script lang="ts">
  import AdminReviewQueuePage from '@oss-tips/ui/pages/admin/AdminReviewQueuePage.svelte';

  let { data } = $props();
</script>

<AdminReviewQueuePage {...data} />
