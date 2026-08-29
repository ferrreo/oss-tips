<script lang="ts">
  import ReviewPage from '@oss-tips/ui/pages/admin/ReviewPage.svelte';

  let { data } = $props();
</script>

<ReviewPage {...data} />
