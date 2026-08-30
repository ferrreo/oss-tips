<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import TextField from '../../components/TextField.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { discordRoleRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';

  type DiscordRoleRow = {
    tier: string;
    role: string;
    members: string;
    lastSync: string;
    status?: string;
  };

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    roleRows?: DiscordRoleRow[];
    discordGuild?: { id: string; name: string; botInstalled: boolean };
    pageState?: 'ready' | 'error' | 'permission';
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    roleRows = discordRoleRows,
    discordGuild,
    pageState = 'ready',
  }: Props = $props();

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  const displayRoleRows = (rows: DiscordRoleRow[]) =>
    rows.map((row) => ({
      ...row,
      lastSync:
        row.status && !['active', 'removed'].includes(row.status)
          ? `${row.status.replaceAll('_', ' ')} · ${row.lastSync}`
          : row.lastSync,
    }));
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.discord.title')}
  lede={tx('project.discord.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.discord.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.discord.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.discord.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.discord.permissionBody')}</p>
    </div>
  {:else}
    {#if discordGuild?.botInstalled}
      <StatusBanner
        variant="info"
        title={tx('project.discord.connected')}
        message={tx('project.discord.connectedBody', { project: project.name })}
      />
      <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="discord-settings-heading">
        <h2 id="discord-settings-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.discord.connectionHeading')}</h2>
        <div class={stylex.attrs(projectStyles.stack).class}>
          <TextField label={tx('project.discord.serverId')} value={discordGuild.id} disabled />
          {#if discordGuild.name}
            <TextField label={tx('project.discord.serverName')} value={discordGuild.name} disabled />
          {/if}
        </div>
      </section>
    {:else}
      <StatusBanner
        variant="warning"
        title={tx('project.discord.notConnected')}
        message={tx('project.discord.notConnectedBody')}
      />
    {/if}
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.discord.mappingHeading')}</h2>
    {#if roleRows.length > 0}
      <Table
        caption={tx('project.discord.mappingCaption', { project: project.name })}
        columns={[
          { key: 'tier', label: tx('project.discord.tier') },
          { key: 'role', label: tx('project.discord.role') },
          { key: 'members', label: tx('project.discord.members') },
          { key: 'lastSync', label: tx('project.discord.lastSync') },
        ]}
        rows={displayRoleRows(roleRows)}
      />
    {:else}
      <EmptyState title={tx('project.discord.emptyTitle')} description={tx('project.discord.emptyBody')} />
    {/if}
  {/if}
</ProjectDashShell>
