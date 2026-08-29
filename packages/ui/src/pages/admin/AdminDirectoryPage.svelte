<script lang="ts">
  import AdminShell from '../../components/AdminShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Table from '../../components/Table.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import { adminNav, directoryProjects, directoryPeople } from './admin-demo.js';

  let search = $state('');
  let view = $state('projects');

  const q = $derived(search.trim().toLowerCase());

  const projectRows = $derived(
    directoryProjects
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.repository.toLowerCase().includes(q),
      )
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        repository: p.repository,
        verified: p.verified,
        payments: p.payments,
        supporters: p.supporters,
        fee: p.feeMode,
      })),
  );

  const peopleRows = $derived(
    directoryPeople
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.projects.toLowerCase().includes(q),
      )
      .map((p) => ({
        name: p.name,
        email: p.email,
        role: p.role,
        projects: p.projects,
        signedIn: p.signedIn,
      })),
  );
</script>

<AdminShell navGroups={adminNav('/admin/directory')} title="Directory">
  <AdminOperatorBar
    context="Projects, people, and supporters"
    detail="Opening a project here does not sign you in as that team. Start read-only view-as from a case if you need their dashboard."
  />

  <TextField
    label="Search directory"
    name="directory-search"
    bind:value={search}
    type="search"
    placeholder="Name, slug, repository, or email"
  />

  <div style="margin: 1rem 0;">
    <SegmentedControl
      label="Directory view"
      value={view}
      options={[
        { value: 'projects', label: 'Projects' },
        { value: 'people', label: 'People' },
      ]}
      onchange={(v) => (view = v)}
    />
  </div>

  {#if view === 'projects'}
    <Table
      caption="{projectRows.length} projects matching the current search."
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        { key: 'repository', label: 'Repository' },
        { key: 'verified', label: 'Verified' },
        { key: 'payments', label: 'Payments' },
        { key: 'supporters', label: 'Supporters' },
        { key: 'fee', label: 'Fee mode' },
      ]}
      rows={projectRows}
    />
  {:else}
    <Table
      caption="{peopleRows.length} people matching the current search."
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'projects', label: 'Projects' },
        { key: 'signedIn', label: 'Last signed in' },
      ]}
      rows={peopleRows}
    />
  {/if}

  <p class="pl-muted" style="font-size: 0.8125rem; margin-top: 1rem;">
    Guest supporters stay email-hidden from project teams. Directory search is operator-only.
  </p>
</AdminShell>
