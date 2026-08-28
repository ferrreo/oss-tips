<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import { demoProject, demoPosts, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Posts">
  <div class="pl-row pl-row--between" style="margin-bottom: 1rem;">
    <p class="pl-muted">Updates for supporters and the public.</p>
    <Button variant="primary">New post</Button>
  </div>
  <Table
    columns={[
      { key: 'title', label: 'Title' },
      { key: 'visibility', label: 'Visibility' },
      { key: 'published', label: 'Published' },
    ]}
    rows={demoPosts.map((p) => ({
      title: p.title,
      visibility: p.tierVisibility,
      published: p.publishedAt,
    }))}
  />
</DashboardShell>
