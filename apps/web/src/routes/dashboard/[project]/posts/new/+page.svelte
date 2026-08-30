<script lang="ts">
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { Attachment, UploadState } from '@oss-tips/ui/components/MarkdownPostEditor.svelte';
  import { formatAttachmentSize, uploadPostAttachment } from '$lib/post-attachment-upload';
  import ProjectPostEditorPage from '@oss-tips/ui/pages/project/ProjectPostEditorPage.svelte';
  import type { PostEditorInput, PostEditorResult } from '@oss-tips/ui/pages/project/ProjectPostEditorPage.svelte';

  let { data } = $props();
  let postId = $state<string | null>(null);
  let postVersion = $state('');
  let uploadState = $state<UploadState>('idle');
  let uploadProgress = $state(0);
  let uploadError = $state<string | undefined>();
  let attachments = $state<Attachment[]>([]);
  let saveInFlight: Promise<PostEditorResult> | undefined;

  async function request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(path, init);
    } catch {
      throw new Error(t('common.networkError', {}, $locale));
    }
  }

  async function saveDraft(input: PostEditorInput): Promise<PostEditorResult> {
    if (saveInFlight) await saveInFlight.catch(() => undefined);
    const operation = saveDraftRequest(input);
    saveInFlight = operation;
    try {
      return await operation;
    } finally {
      if (saveInFlight === operation) saveInFlight = undefined;
    }
  }

  async function saveDraftRequest(input: PostEditorInput): Promise<PostEditorResult> {
    const response = await request(
      postId ? `/api/v1/project/posts/${encodeURIComponent(postId)}` : '/api/v1/project/posts',
      {
        method: postId ? 'PATCH' : 'POST',
        headers: {
          'content-type': 'application/json',
          'x-project-id': data.project.slug,
          ...(input.version || postVersion ? { 'if-match': input.version || postVersion } : {}),
        },
        body: JSON.stringify(editorPayload(input)),
      },
    );
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('project.postEditor.saveError', {}, $locale));
    if (!postId && isPostPayload(payload)) postId = payload.id;
    postVersion = response.headers.get('etag') ?? postVersion;
    return { version: postVersion || undefined };
  }

  async function uploadAttachment(file: File, input: PostEditorInput): Promise<string> {
    uploadState = 'uploading';
    uploadProgress = 0;
    uploadError = undefined;
    try {
      if (!postId) await saveDraft(input);
      if (!postId) throw new Error('Post was not created');
      const uploaded = await uploadPostAttachment(file, {
        projectId: data.project.slug,
        postId,
        onProgress: (percent) => (uploadProgress = percent),
      });
      attachments = [
        ...attachments,
        {
          id: uploaded.attachmentId,
          name: file.name,
          sizeLabel: formatAttachmentSize(file.size),
          url: uploaded.downloadUrl,
        },
      ];
      uploadProgress = 100;
      uploadState = 'ready';
      return uploaded.downloadUrl;
    } catch {
      uploadState = 'error';
      uploadError = t('editor.uploadStartError', {}, $locale);
      throw new Error(uploadError);
    }
  }

  async function publish(input: PostEditorInput): Promise<void> {
    await saveDraft(input);
    if (!postId) throw new Error(t('common.actionFailed', {}, $locale));
    const response = await request(`/api/v1/project/posts/${encodeURIComponent(postId)}/publish`, {
      method: 'POST',
      headers: { 'x-project-id': data.project.slug },
    });
    await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('common.actionFailed', {}, $locale));
  }

  async function refreshVersion(): Promise<string | undefined> {
    if (!postId) return undefined;
    const response = await request(`/api/v1/project/posts/${encodeURIComponent(postId)}`, {
      headers: { 'x-project-id': data.project.slug },
    });
    await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('common.actionFailed', {}, $locale));
    postVersion = response.headers.get('etag') ?? postVersion;
    return postVersion || undefined;
  }

  function editorPayload(input: PostEditorInput) {
    const visibility = input.visibility === 'public' ? 'public' : input.visibility === 'supporter' ? 'signed_in_supporter' : 'minimum_tier_rank';
    return {
      title: input.title,
      slug: input.slug || slugFromTitle(input.title),
      body: input.body,
      visibility,
      ...(visibility === 'minimum_tier_rank' ? { minimum_tier_rank: input.visibility === 'backer' ? 2 : 1 } : {}),
    };
  }

  function slugFromTitle(title: string): string {
    return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'untitled-post';
  }

  function isPostPayload(value: unknown): value is { id: string } {
    return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
  }

  function requestError(response: Response, fallback: string): Error & { status: number } {
    const failure = new Error(fallback) as Error & { status: number };
    failure.status = response.status;
    return failure;
  }
</script>

<ProjectPostEditorPage
  {...data}
  mode="new"
  {uploadState}
  {uploadProgress}
  {uploadError}
  {attachments}
  onUploadAttachment={uploadAttachment}
  onSaveDraft={saveDraft}
  onPublish={publish}
  onRefreshVersion={refreshVersion}
/>
