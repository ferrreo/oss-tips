<script lang="ts">
  import ProjectPostPage from '@oss-tips/ui/pages/public/ProjectPostPage.svelte';
  import { page } from '$app/state';

  let { data } = $props();
</script>

<ProjectPostPage {...data} slug={page.params.slug} />
