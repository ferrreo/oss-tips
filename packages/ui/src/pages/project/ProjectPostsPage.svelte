<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Table from '../../components/Table.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TextField from '../../components/TextField.svelte';
  import type { NavGroup, Post, Project } from '../../fixtures/demo.js';
  import { demoPosts, demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPosts } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, formatNumber, locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    posts?: Post[];
    pageState?: 'ready' | 'error' | 'permission';
    onNewPost?: () => void;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    posts = [...demoPosts, ...extraPosts],
    pageState = 'ready',
    onNewPost,
  }: Props = $props();

  let search = $state('');
  const visiblePosts = $derived(
    posts.filter((post) => {
      const query = search.trim().toLowerCase();
      return !query || `${post.title} ${post.slug}`.toLowerCase().includes(query);
    }),
  );
  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const visibilityLabel = (value: string) =>
    value.toLowerCase().includes('backer')
      ? tx('project.postEditor.backer')
      : value.toLowerCase().includes('supporter') || value.toLowerCase().includes('member')
        ? tx('project.postEditor.supporter')
        : tx('project.postEditor.public');
  const publishedLabel = (post: Post) =>
    post.publishedAt === '—' || post.publishedAt.toLowerCase() === 'draft'
      ? post.publishedLabel
      : formatDate(post.publishedAt, $locale);
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.posts.title')}
  lede={tx('project.posts.lede')}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.posts.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.posts.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.posts.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.posts.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.between).class}>
      <p class={stylex.attrs(projectStyles.body).class}><bdi>{tx('project.posts.count', { count: formatNumber(posts.length, $locale), project: project.name })}</bdi></p>
      <Button variant="primary" label={tx('project.posts.newButton')} onclick={() => onNewPost?.()} />
    </div>
    <div class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class}>
      <TextField label={tx('project.posts.search')} bind:value={search} placeholder={tx('project.posts.searchPlaceholder')} />
    </div>
    {#if visiblePosts.length > 0}
      <div class={stylex.attrs(projectStyles.section).class}>
        <Table
          caption={tx('project.posts.caption', { project: project.name })}
          columns={[
            { key: 'title', label: tx('project.posts.titleColumn') },
            { key: 'visibility', label: tx('project.posts.visibilityColumn') },
            { key: 'published', label: tx('project.posts.publishedColumn') },
          ]}
          rows={visiblePosts.map((post) => ({ title: post.title, visibility: visibilityLabel(post.tierVisibility), published: publishedLabel(post) }))}
        />
      </div>
    {:else}
      <div class={stylex.attrs(projectStyles.section).class}>
        <EmptyState headingLevel={2} title={search ? tx('project.posts.noMatchingTitle') : tx('project.posts.emptyTitle')} description={search ? tx('project.posts.noMatchingBody') : tx('project.posts.emptyBody')} />
      </div>
    {/if}
  {/if}
</ProjectDashShell>
