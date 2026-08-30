<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TextField from '../../components/TextField.svelte';
  import ProjectLifecyclePanel from '../../components/ProjectLifecyclePanel.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { teamRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    members?: typeof teamRows;
    pageState?: 'ready' | 'error' | 'permission';
    projectCapabilities?: readonly string[];
    onInvite?: (input: { email: string; role: string }) => void | Promise<void>;
    onTransferOwnership?: (email: string) => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    members = teamRows,
    pageState = 'ready',
    projectCapabilities = [],
    onInvite,
    onTransferOwnership,
  }: Props = $props();

  let inviteEmail = $state('grove@grove.dev');
  let inviteRole = $state('editor');
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const tableRows = $derived(
    members.map((member) => ({
      ...member,
      lastActive: member.lastActiveAt ? formatDate(member.lastActiveAt, $locale) : member.lastActive,
    })),
  );

  async function inviteMember() {
    if (!onInvite || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onInvite({ email: inviteEmail.trim(), role: inviteRole.trim().toLowerCase() });
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.team.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.team.title')}
  lede={tx('project.team.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.team.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.team.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.team.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.team.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.between).class}>
      <p class={stylex.attrs(projectStyles.body).class}><bdi>{tx('project.team.accessCount', { count: formatNumber(members.length, $locale) })}</bdi></p>
      <Button variant="primary" label={tx('project.team.invite')} loading={actionState === 'saving'} disabled={!onInvite || actionState !== 'idle'} onclick={() => void inviteMember()} />
    </div>
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="invite-heading">
      <h2 id="invite-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.team.inviteHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField label={tx('project.team.email')} bind:value={inviteEmail} type="email" />
        <TextField label={tx('project.team.role')} bind:value={inviteRole} help={tx('project.team.roleHelp')} />
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
      </div>
    </section>
    <div class={stylex.attrs(projectStyles.section).class}>
      {#if members.length > 0}
        <Table
          caption={tx('project.team.caption')}
          columns={[
            { key: 'name', label: tx('project.team.name') },
            { key: 'email', label: tx('project.team.email') },
            { key: 'role', label: tx('project.team.role') },
            { key: 'lastActive', label: tx('project.team.lastActive') },
          ]}
          rows={tableRows}
        />
      {:else}
        <EmptyState title={tx('project.team.emptyTitle')} description={tx('project.team.emptyBody')} />
      {/if}
    </div>
    <ProjectLifecyclePanel
      projectName={project.name}
      projectStatus={project.status ?? 'published'}
      {projectCapabilities}
      teamMembers={members}
      {onTransferOwnership}
    />
  {/if}
</ProjectDashShell>
