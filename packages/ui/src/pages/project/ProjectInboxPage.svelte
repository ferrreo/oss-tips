<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import ThreadView, { type ThreadAction } from '../../components/ThreadView.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Badge from '../../components/Badge.svelte';
  import type { NavGroup, Project, Thread } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { inboxPreviewFromThread, inboxThreads } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { formatCurrency, formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    threads?: Thread[];
    pageState?: 'ready' | 'error' | 'permission';
    blocked?: boolean;
    reported?: boolean;
    onSendReply?: ThreadAction;
    onBlockThread?: ThreadAction;
    onReportThread?: ThreadAction;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    threads = inboxThreads,
    pageState = 'ready',
    blocked = false,
    reported = false,
    onSendReply,
    onBlockThread,
    onReportThread,
  }: Props = $props();

  let selectedId = $state('');
  const selected = $derived(threads.find((thread) => thread.id === selectedId));
  const previewRows = $derived(
    threads.map((thread) => {
      const row = inboxPreviewFromThread(thread);
      return {
        ...row,
        amount: row.amountMinor !== undefined ? formatCurrency(row.amountMinor, row.currency ?? project.currency, $locale) : row.amount,
        time: row.timeAt ? formatDate(row.timeAt, $locale) : row.time,
      };
    }),
  );

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  $effect(() => {
    if (!threads.some((thread) => thread.id === selectedId)) {
      selectedId = threads[0]?.id ?? '';
    }
  });
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.inbox.title')}
  lede={tx('project.inbox.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.inbox.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.inbox.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.inbox.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.inbox.permissionBody')}</p>
    </div>
  {:else if threads.length === 0}
    <EmptyState headingLevel={2} title={tx('project.inbox.emptyTitle')} description={tx('project.inbox.emptyBody')} />
  {:else if selected}
    <div class={stylex.attrs(projectStyles.grid2, projectStyles.responsiveStack).class}>
      <aside class={stylex.attrs(projectStyles.surfaceTight).class} aria-label={tx('project.inbox.conversations')}>
        <ul class={stylex.attrs(projectStyles.inboxList).class}>
          {#each previewRows as row (row.id)}
            <li>
              <button
                type="button"
                class={stylex.attrs(projectStyles.inboxButton, row.id === selectedId ? projectStyles.selected : null, primitives.focusRing).class}
                aria-pressed={row.id === selectedId}
                onclick={() => (selectedId = row.id)}
              >
                <span class={stylex.attrs(projectStyles.avatar).class} aria-hidden="true">{row.initial}</span>
                <span class={stylex.attrs(projectStyles.truncate).class}>
                  <span class={stylex.attrs(projectStyles.row).class}>
                    <strong class={stylex.attrs(projectStyles.small).class}>{row.name}</strong>
                    {#if row.unread}
                      <Badge variant="forest" label={tx('project.inbox.new')} />
                    {/if}
                  </span>
                  <span class={stylex.attrs(projectStyles.muted, projectStyles.small, projectStyles.truncate).class}>{row.snippet}</span>
                </span>
                <span class={stylex.attrs(projectStyles.numeric, projectStyles.small).class}>{row.amount}</span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>
      <ThreadView
        thread={selected}
        actor="project"
        blocked={blocked}
        reported={reported}
        onSendReply={onSendReply}
        onBlock={onBlockThread}
        onReport={onReportThread}
      />
    </div>
  {/if}
</ProjectDashShell>
