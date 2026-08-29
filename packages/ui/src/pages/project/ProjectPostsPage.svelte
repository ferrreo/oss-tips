<script lang="ts">
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoPosts } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPosts } from './project-demo.js';

  const posts = [...demoPosts, ...extraPosts];
</script>

<ProjectDashShell title="Posts" lede="Write updates. Gate some of them by Coffee, Supporter, or Backer.">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p style="margin: 0; color: var(--pl-ink);">{posts.length} posts for Grove, including one draft.</p>
    <Button variant="primary">New post</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <TextField label="Search posts" value="infrastructure" placeholder="Title or slug" />
  </div>
  <Table
    caption="Published and draft Grove posts"
    columns={[
      { key: 'title', label: 'Title' },
      { key: 'visibility', label: 'Visibility' },
      { key: 'published', label: 'Published' },
    ]}
    rows={posts.map((post) => ({
      title: post.title,
      visibility: post.tierVisibility,
      published: post.publishedLabel,
    }))}
  />
</ProjectDashShell>
