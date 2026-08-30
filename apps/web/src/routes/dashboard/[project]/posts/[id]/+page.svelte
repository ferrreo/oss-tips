<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import type { Attachment, UploadState } from '@oss-tips/ui/components/MarkdownPostEditor.svelte';
  import { formatAttachmentSize, uploadPostAttachment } from '$lib/post-attachment-upload';
  import ProjectPostEditorPage from '@oss-tips/ui/pages/project/ProjectPostEditorPage.svelte';
  import type { PostEditorInput, PostEditorResult } from '@oss-tips/ui/pages/project/ProjectPostEditorPage.svelte';

  let { data } = $props();
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
    const response = await request(`/api/v1/project/posts/${encodeURIComponent(data.draft.id)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-project-id': data.project.slug,
        ...(input.version ? { 'if-match': input.version } : {}),
      },
      body: JSON.stringify(editorPayload(input)),
    });
    await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('project.postEditor.saveError', {}, $locale));
    return { version: response.headers.get('etag') ?? undefined };
  }

  async function loadAttachments() {
    if (data.source !== 'db') return;
    try {
      const response = await request(
        `/api/v1/project/posts/${encodeURIComponent(data.draft.id)}/attachments`,
        { headers: { 'x-project-id': data.project.slug } },
      );
      const payload = await response.json().catch(() => undefined);
      if (!response.ok || !Array.isArray(payload)) throw new Error('Attachment list failed');
      attachments = payload.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const value = item as Record<string, unknown>;
        return typeof value.id === 'string'
          ? [
              {
                id: value.id,
                name:
                  typeof value.content_type === 'string' && value.content_type.length > 0
                    ? t('editor.attachmentType', { type: value.content_type }, $locale)
                    : t('editor.attachmentReady', {}, $locale),
                sizeLabel:
                  typeof value.content_length === 'number' &&
                  Number.isFinite(value.content_length) &&
                  value.content_length >= 0
                    ? formatAttachmentSize(value.content_length)
                    : undefined,
                url: typeof value.download_url === 'string' ? value.download_url : undefined,
              },
            ]
          : [];
      });
    } catch {
      uploadState = 'error';
      uploadError = t('editor.uploadStartError', {}, $locale);
    }
  }

  async function uploadAttachment(file: File): Promise<string> {
    uploadState = 'uploading';
    uploadProgress = 0;
    uploadError = undefined;
    try {
      const uploaded = await uploadPostAttachment(file, {
        projectId: data.project.slug,
        postId: data.draft.id,
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

  onMount(() => {
    void loadAttachments();
  });

  async function publish(input: PostEditorInput): Promise<void> {
    await saveDraft(input);
    const response = await request(`/api/v1/project/posts/${encodeURIComponent(data.draft.id)}/publish`, {
      method: 'POST',
      headers: { 'x-project-id': data.project.slug },
    });
    await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('common.actionFailed', {}, $locale));
  }

  async function refreshVersion(): Promise<string | undefined> {
    const response = await request(`/api/v1/project/posts/${encodeURIComponent(data.draft.id)}`, {
      headers: { 'x-project-id': data.project.slug },
    });
    await response.json().catch(() => undefined);
    if (!response.ok) throw requestError(response, t('common.actionFailed', {}, $locale));
    return response.headers.get('etag') ?? undefined;
  }

  function editorPayload(input: PostEditorInput) {
    const visibility = input.visibility === 'public' ? 'public' : input.visibility === 'supporter' ? 'signed_in_supporter' : 'minimum_tier_rank';
    return {
      title: input.title,
      slug: input.slug,
      body: input.body,
      visibility,
      ...(visibility === 'minimum_tier_rank' ? { minimum_tier_rank: input.visibility === 'backer' ? 2 : 1 } : {}),
    };
  }

  function requestError(response: Response, fallback: string): Error & { status: number } {
    const failure = new Error(fallback) as Error & { status: number };
    failure.status = response.status;
    return failure;
  }
</script>

<ProjectPostEditorPage
  {...data}
  {uploadState}
  {uploadProgress}
  {uploadError}
  {attachments}
  onUploadAttachment={uploadAttachment}
  onSaveDraft={saveDraft}
  onPublish={publish}
  onRefreshVersion={refreshVersion}
/>
