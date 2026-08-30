<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import AdminShell from '../../components/AdminShell.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import TextField from '../../components/TextField.svelte';
  import { locale, t, type MessageKey, type MessageValues } from '../../lib/i18n.js';
  import { admin } from '../../styles/admin.stylex.js';
  import AdminOperatorBar from './AdminOperatorBar.svelte';
  import AdminStatePanel from './AdminStatePanel.svelte';
  import {
    adminNav,
    directoryPeople as defaultPeople,
    directoryProjects as defaultProjects,
  } from './admin-demo.js';
  import type { AdminDirectoryPageProps } from './admin-types.js';

  let {
    navGroups = adminNav('/admin/directory'),
    projects = defaultProjects,
    people = defaultPeople,
    initialSearch = '',
    initialView = 'projects',
    state: pageState = 'ready',
  }: AdminDirectoryPageProps = $props();

  // svelte-ignore state_referenced_locally -- route/story seeds are intentionally copied into local controls.
  let search = $state(initialSearch);
  // svelte-ignore state_referenced_locally -- view is a local segmented control.
  let view = $state<'projects' | 'people'>(initialView);

  const tt = (key: string, values: MessageValues = {}) => t(key as MessageKey, values, $locale);

  const normaliseEnum = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const directoryStatusKeys: Record<string, string> = {
    verified: 'admin.status.verified',
    draft: 'admin.status.draft',
    pending: 'admin.status.pending',
    pending_review: 'admin.status.pendingReview',
    published: 'admin.status.published',
    restricted: 'admin.status.restricted',
    suspended: 'admin.status.suspended',
    archived: 'admin.status.archived',
    blocked: 'admin.status.blocked',
    rejected: 'admin.status.rejected',
    approved: 'admin.status.approved',
  };
  const paymentStateKeys: Record<string, string> = {
    ready: 'admin.directory.paymentReady',
    no_payments: 'admin.directory.paymentNone',
    no_payment: 'admin.directory.paymentNone',
    restricted: 'admin.directory.paymentRestricted',
    review: 'admin.directory.paymentReview',
  };
  const feeModeKeys: Record<string, string> = {
    standard: 'admin.directory.feeStandard',
    project_5pct: 'admin.directory.feeProject5pct',
    project_5_percent: 'admin.directory.feeProject5pct',
    contributes_5_percent: 'admin.directory.feeProject5pct',
  };
  const roleKeys: Record<string, string> = {
    supporter: 'admin.directory.roleSupporter',
    project_owner: 'admin.directory.roleProjectOwner',
    owner: 'admin.directory.roleOwner',
    admin: 'admin.directory.roleAdmin',
    guest_supporter: 'admin.directory.roleGuestSupporter',
    user: 'admin.directory.roleUser',
  };

  const knownEnumLabel = (value: string, keys: Record<string, string>) => {
    const key = keys[normaliseEnum(value)];
    return key ? tt(key) : value;
  };

  const query = $derived(search.trim().toLowerCase());

  const projectRows = $derived(
    projects
      .filter(
        (project) =>
          !query ||
          project.name.toLowerCase().includes(query) ||
          project.slug.toLowerCase().includes(query) ||
          project.repository.toLowerCase().includes(query),
      )
      .map((project) => ({
        name: project.name,
        slug: project.slug,
        repository: project.repository,
        verified: knownEnumLabel(project.verified, directoryStatusKeys),
        payments: knownEnumLabel(project.payments, paymentStateKeys),
        supporters: project.supporters,
        fee: knownEnumLabel(project.feeMode, feeModeKeys),
      })),
  );

  const peopleRows = $derived(
    people
      .filter(
        (person) =>
          !query ||
          person.name.toLowerCase().includes(query) ||
          person.email.toLowerCase().includes(query) ||
          person.projects.toLowerCase().includes(query),
      )
      .map((person) => ({
        name: person.name,
        email: person.email,
        role: knownEnumLabel(person.role, roleKeys),
        projects: person.projects,
        signedIn: knownEnumLabel(person.signedIn, { not_signed_in: 'admin.directory.notSignedIn' }),
      })),
  );
</script>

<AdminShell navGroups={navGroups} title={tt('admin.title.directory')}>
  {#if pageState !== 'ready'}
    <AdminStatePanel state={pageState} />
  {:else}
    <div {...stylex.attrs(admin.page)}>
      <AdminOperatorBar
        context={tt('admin.operator.directoryContext')}
        detail={tt('admin.operator.directoryDetail')}
      />

      <TextField
        label={tt('admin.directory.searchLabel')}
        name="directory-search"
        bind:value={search}
        type="search"
        placeholder={tt('admin.directory.searchPlaceholder')}
      />

      <SegmentedControl
        label={tt('admin.directory.viewLabel')}
        value={view}
        options={[
          { value: 'projects', label: tt('admin.directory.projects') },
          { value: 'people', label: tt('admin.directory.people') },
        ]}
        onchange={(value) => (view = value as 'projects' | 'people')}
      />

      {#if view === 'projects'}
        <div {...stylex.attrs(admin.tableWrap)}>
          <Table
            caption={tt('admin.directory.projectCaption', { count: projectRows.length })}
            columns={[
              { key: 'name', label: tt('admin.directory.name') },
              { key: 'slug', label: tt('admin.directory.slug') },
              { key: 'repository', label: tt('admin.directory.repository') },
              { key: 'verified', label: tt('admin.directory.verified') },
              { key: 'payments', label: tt('admin.directory.payments') },
              { key: 'supporters', label: tt('admin.directory.supporters') },
              { key: 'fee', label: tt('admin.directory.feeMode') },
            ]}
            rows={projectRows}
          />
        </div>
      {:else}
        <div {...stylex.attrs(admin.tableWrap)}>
          <Table
            caption={tt('admin.directory.peopleCaption', { count: peopleRows.length })}
            columns={[
              { key: 'name', label: tt('admin.directory.name') },
              { key: 'email', label: tt('admin.directory.email') },
              { key: 'role', label: tt('admin.directory.role') },
              { key: 'projects', label: tt('admin.directory.projectsColumn') },
              { key: 'signedIn', label: tt('admin.directory.lastSignedIn') },
            ]}
            rows={peopleRows}
          />
        </div>
      {/if}

      <p {...stylex.attrs(admin.footnote)}>
        {tt('admin.directory.footnote')}
      </p>
    </div>
  {/if}
</AdminShell>
