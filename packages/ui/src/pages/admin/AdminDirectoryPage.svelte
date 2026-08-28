<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Table from '../../components/Table.svelte';
  import { adminNavGroups, featuredProjects } from '../../fixtures/demo.js';

  let search = $state('');
</script>

<AdminShell navGroups={adminNavGroups} title="Project directory">
  <TextField label="Search projects" value={search} type="search" placeholder="Name, slug, or repository…" />
  <Table
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'verified', label: 'Verified' },
      { key: 'supporters', label: 'Supporters' },
    ]}
    rows={featuredProjects
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        verified: p.verified ? 'Yes' : 'Pending',
        supporters: String(p.stats.supporters),
      }))}
    style="margin-top: 1rem;"
  />
</AdminShell>
