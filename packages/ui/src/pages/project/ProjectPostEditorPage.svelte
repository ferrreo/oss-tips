<script lang="ts">
  import { onMount } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import MarkdownPostEditor, {
    type Attachment,
    type UploadState,
  } from '../../components/MarkdownPostEditor.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Post, Project } from '../../fixtures/demo.js';
  import { demoPosts, demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPosts } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';

  const defaultDraft: Post = {
    id: 'p1',
    slug: 'infrastructure-goal-update',
    title: 'Infrastructure goal: 60% and the second region is scoped',
    excerpt: 'Checkout failover plan, object-storage cutover, and what $45,230 has already bought.',
    body: 'We signed the second-region contract and started the object-storage cutover.',
    publishedAt: '2026-05-28',
    publishedLabel: 'May 28, 2026',
    tierVisibility: 'Public',
    author: 'Ada Lovelace',
  };

  export interface PostEditorInput {
    title: string;
    slug: string;
    body: string;
    visibility: string;
    version?: string;
  }

  export interface PostEditorResult {
    version?: string;
  }

  export type PostEditorAction = (input: PostEditorInput) => void | PostEditorResult | Promise<void | PostEditorResult>;

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    draft?: Post;
    recentPosts?: Post[];
    mode?: 'new' | 'edit';
    pageState?: 'ready' | 'error' | 'permission';
    onSaveDraft?: PostEditorAction;
    onPublish?: PostEditorAction;
    uploadState?: UploadState;
    uploadProgress?: number;
    uploadError?: string;
    attachments?: Attachment[];
    onUploadAttachment?: (
      file: File,
      input: PostEditorInput,
    ) => string | void | Promise<string | void>;
    autosave?: boolean;
    onRefreshVersion?: () => string | undefined | Promise<string | undefined>;
    initialAutosaveState?: 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    draft = demoPosts[0] ?? defaultDraft,
    recentPosts = [...demoPosts, ...extraPosts],
    mode = 'edit',
    pageState = 'ready',
    onSaveDraft,
    onPublish,
    uploadState = 'idle',
    uploadProgress = 0,
    uploadError,
    attachments = [],
    onUploadAttachment,
    autosave = true,
    onRefreshVersion,
    initialAutosaveState = 'idle',
  }: Props = $props();

  let title = $state('');
  let slug = $state('');
  let visibility = $state('public');
  let body = $state('');
  let actionState = $state<'idle' | 'saving' | 'publishing'>('idle');
  let actionError = $state('');
  let serverVersion = $state('');
  let autosaveState = $state<'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  let localDraft = $state<LocalDraft | null>(null);
  let hydrated = $state(false);
  let savedSnapshot = $state<EditorSnapshot | null>(null);
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  type EditorSnapshot = { title: string; slug: string; body: string; visibility: string };
  type LocalDraft = EditorSnapshot & { savedAt: number };

  const draftStorageKey = $derived(`oss-tips:post-draft:${project.slug}:${draft.id || 'new'}`);

  $effect(() => {
    title = draft.title;
    slug = draft.slug;
    body = draft.body;
    visibility = visibilityFromLabel(draft.tierVisibility);
    serverVersion = draft.version ?? '';
    savedSnapshot = { title: draft.title, slug: draft.slug, body: draft.body, visibility: visibilityFromLabel(draft.tierVisibility) };
  });

  $effect(() => {
    autosaveState = initialAutosaveState;
  });

  onMount(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isLocalDraft(parsed)) localDraft = parsed;
      }
    } catch {
      localDraft = null;
    }
    hydrated = true;
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });

  $effect(() => {
    if (!hydrated || !autosave || !onSaveDraft || actionState !== 'idle') return;
    const snapshot = currentSnapshot();
    if (!savedSnapshot || sameSnapshot(snapshot, savedSnapshot)) return;
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    } catch {
      autosaveState = 'error';
      actionError = tx('editor.autosaveError');
      return;
    }
    autosaveState = 'pending';
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void saveAutomatically(snapshot), 900);
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });

  function visibilityFromLabel(label: string): string {
    const value = label.toLowerCase();
    if (value.includes('backer')) return 'backer';
    if (value.includes('supporter') || value.includes('member')) return 'supporter';
    return 'public';
  }

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

  function currentSnapshot(): EditorSnapshot {
    return { title, slug, body, visibility };
  }

  function editorInput(snapshot: EditorSnapshot): PostEditorInput {
    const version = serverVersion || draft.version;
    return version ? { ...snapshot, version } : snapshot;
  }

  function sameSnapshot(left: EditorSnapshot, right: EditorSnapshot): boolean {
    return left.title === right.title && left.slug === right.slug && left.body === right.body && left.visibility === right.visibility;
  }

  function isLocalDraft(value: unknown): value is LocalDraft {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Record<string, unknown>;
    return (
      typeof draft.title === 'string' &&
      typeof draft.slug === 'string' &&
      typeof draft.body === 'string' &&
      typeof draft.visibility === 'string' &&
      typeof draft.savedAt === 'number'
    );
  }

  function isConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
  }

  function clearLocalDraft() {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Storage can be disabled in private browsing. Saved server content still wins.
    }
  }

  function applySaved(result: void | PostEditorResult, snapshot: EditorSnapshot) {
    if (result?.version) serverVersion = result.version;
    savedSnapshot = snapshot;
    clearLocalDraft();
    autosaveState = 'saved';
  }

  async function saveAutomatically(snapshot: EditorSnapshot) {
    if (actionState !== 'idle' || !onSaveDraft) return;
    actionState = 'saving';
    autosaveState = 'saving';
    actionError = '';
    try {
      const result = await onSaveDraft(editorInput(snapshot));
      applySaved(result, snapshot);
    } catch (error) {
      if (isConflict(error)) {
        autosaveState = 'conflict';
        actionError = tx('editor.saveConflict');
      } else {
        autosaveState = 'error';
        actionError = error instanceof Error ? error.message : tx('project.postEditor.saveError');
      }
    } finally {
      actionState = 'idle';
    }
  }

  function restoreLocalDraft() {
    if (!localDraft) return;
    title = localDraft.title;
    slug = localDraft.slug;
    body = localDraft.body;
    visibility = localDraft.visibility;
    localDraft = null;
  }

  function discardLocalDraft() {
    localDraft = null;
    clearLocalDraft();
  }

  async function refreshVersion() {
    if (!onRefreshVersion || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      const version = await onRefreshVersion();
      if (version) serverVersion = version;
      autosaveState = 'idle';
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('editor.refreshVersionError');
      autosaveState = 'error';
    } finally {
      actionState = 'idle';
    }
  }

  async function requestUpload(file: File) {
    if (!onUploadAttachment) return;
    return onUploadAttachment(file, editorInput(currentSnapshot()));
  }

  async function runAction(kind: 'saving' | 'publishing') {
    if (actionState !== 'idle') return;
    actionError = '';
    actionState = kind;
    try {
      const snapshot = currentSnapshot();
      const result = await (kind === 'saving' ? onSaveDraft : onPublish)?.(editorInput(snapshot));
      applySaved(result, snapshot);
    } catch (error) {
      if (isConflict(error)) {
        autosaveState = 'conflict';
        actionError = tx('editor.saveConflict');
      } else {
        autosaveState = 'error';
        actionError = error instanceof Error ? error.message : tx('project.postEditor.saveError');
      }
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={mode === 'new' ? tx('project.postEditor.newTitle') : tx('project.postEditor.editTitle')}
  lede={tx('project.postEditor.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.postEditor.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.postEditor.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.postEditor.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.postEditor.permissionBody')}</p>
    </div>
  {:else}
    {#if localDraft}
      <div class={stylex.attrs(projectStyles.permission, projectStyles.section).class} role="status">
        <strong>{tx('editor.localDraftAvailable')}</strong>
        <div class={stylex.attrs(projectStyles.row).class}>
          <Button variant="primary" label={tx('editor.restoreLocalDraft')} onclick={restoreLocalDraft} />
          <Button variant="quiet" label={tx('editor.discardLocalDraft')} onclick={discardLocalDraft} />
        </div>
      </div>
    {/if}
    {#if autosaveState === 'conflict'}
      <div class={stylex.attrs(projectStyles.error, projectStyles.section).class} role="alert">
        <strong>{tx('editor.saveConflict')}</strong>
        {#if onRefreshVersion}
          <div class={stylex.attrs(projectStyles.row).class}>
            <Button variant="secondary" label={tx('editor.refreshVersion')} loading={actionState === 'saving'} disabled={actionState !== 'idle'} onclick={() => void refreshVersion()} />
          </div>
        {/if}
      </div>
    {/if}
    <div class={stylex.attrs(projectStyles.grid2, projectStyles.responsiveStack).class}>
      <section class={stylex.attrs(projectStyles.stack).class} aria-labelledby="post-details-heading">
        <h2 id="post-details-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.postEditor.detailsHeading')}</h2>
        <TextField label={tx('project.postEditor.title')} bind:value={title} placeholder={tx('project.postEditor.titlePlaceholder')} />
        <TextField label={tx('project.postEditor.slug')} bind:value={slug} help={`https://oss.tips/${project.slug}/posts/${slug}`} />
        <div>
          <span class={stylex.attrs(projectStyles.fieldLabel).class}>{tx('project.postEditor.visibility')}</span>
          <SegmentedControl
            options={[
              { value: 'public', label: tx('project.postEditor.public') },
              { value: 'supporter', label: tx('project.postEditor.supporter') },
              { value: 'backer', label: tx('project.postEditor.backer') },
            ]}
            bind:value={visibility}
          />
        </div>
        <MarkdownPostEditor
          id="post-body"
          bind:value={body}
          {visibility}
          error={autosaveState === 'conflict' ? undefined : actionError || undefined}
          {uploadState}
          {uploadProgress}
          {uploadError}
          {attachments}
          onUploadAttachment={requestUpload}
        />
        <TextField label={tx('project.postEditor.excerpt')} value={draft.excerpt} />
        {#if autosaveState === 'pending'}
          <p class={stylex.attrs(projectStyles.muted, projectStyles.small).class} role="status" aria-live="polite">{tx('editor.autosavePending')}</p>
        {:else if autosaveState === 'saving'}
          <p class={stylex.attrs(projectStyles.muted, projectStyles.small).class} role="status" aria-live="polite">{tx('editor.autosaveSaving')}</p>
        {:else if autosaveState === 'saved'}
          <p class={stylex.attrs(projectStyles.muted, projectStyles.small).class} role="status" aria-live="polite">{tx('editor.autosaveSaved')}</p>
        {:else if autosaveState === 'error' && actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
        <div class={stylex.attrs(projectStyles.row).class}>
          <Button variant="primary" label={tx('project.postEditor.publish')} loading={actionState === 'publishing'} disabled={actionState !== 'idle'} onclick={() => void runAction('publishing')} />
          <Button variant="secondary" label={tx('project.postEditor.saveDraft')} loading={actionState === 'saving'} disabled={actionState !== 'idle'} onclick={() => void runAction('saving')} />
        </div>
      </section>
      <section>
        <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.postEditor.recentHeading')}</h2>
        <Table
          caption={tx('project.postEditor.recentCaption', { project: project.name })}
          columns={[
            { key: 'title', label: tx('project.postEditor.tableTitle') },
            { key: 'visibility', label: tx('project.postEditor.tableVisibility') },
            { key: 'published', label: tx('project.postEditor.tablePublished') },
          ]}
          rows={recentPosts.map((post) => ({ title: post.title, visibility: visibilityLabel(post.tierVisibility), published: publishedLabel(post) }))}
        />
      </section>
    </div>
  {/if}
</ProjectDashShell>
