<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, demoPosts, projectNavGroups } from '../../fixtures/demo.js';
  import { extraPosts } from './project-demo.js';

  const posts = [...demoPosts, ...extraPosts];
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Posts">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Updates for supporters and the public.</p>
    <Button variant="primary">New post</Button>
  </div>
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <TextField label="Search posts" value="design tokens" placeholder="Title or slug" />
  </div>
  <Table
    caption="Published and draft posts"
    columns={[
      { key: 'title', label: 'Title' },
      { key: 'visibility', label: 'Visibility' },
      { key: 'published', label: 'Published' },
    ]}
    rows={posts.map((post) => ({
      title: post.title,
      visibility: post.tierVisibility,
      published: post.publishedAt,
    }))}
  />
</DashboardShell>
