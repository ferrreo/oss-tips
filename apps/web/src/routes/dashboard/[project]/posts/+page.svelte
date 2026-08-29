<script lang="ts">
  import PostsPage from '@oss-tips/ui/pages/dashboard/PostsPage.svelte';

  let { data } = $props();
</script>

<PostsPage {...data} />
