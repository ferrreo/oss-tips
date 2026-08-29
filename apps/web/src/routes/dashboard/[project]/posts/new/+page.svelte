<script lang="ts">
  import NewPostPage from '@oss-tips/ui/pages/dashboard/NewPostPage.svelte';

  let { data } = $props();
</script>

<NewPostPage {...data} />
