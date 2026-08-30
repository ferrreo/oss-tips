import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAttachmentSize, uploadPostAttachment } from './post-attachment-upload';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatAttachmentSize', () => {
  it('keeps byte units aligned at each 1024 boundary', () => {
    expect(formatAttachmentSize(1023)).toBe('1023 B');
    expect(formatAttachmentSize(1024)).toBe('1.0 KB');
    expect(formatAttachmentSize(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('uploadPostAttachment', () => {
  it('completes quarantine upload before attaching and returns a usable URL', async () => {
    vi.stubGlobal('XMLHttpRequest', undefined);
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init });
        const path = String(input);
        if (path === '/api/v1/project/assets') {
          return new Response(
            JSON.stringify({
              id: 'asset-1',
              upload_url: 'https://storage.example.test/upload',
              complete_url: '/api/v1/project/assets/asset-1/complete',
            }),
            { status: 201 },
          );
        }
        if (path === 'https://storage.example.test/upload')
          return new Response(null, { status: 200 });
        if (path.endsWith('/complete')) return new Response(JSON.stringify({ status: 'ready' }));
        return new Response(
          JSON.stringify({
            id: 'attachment-1',
            download_url: '/api/v1/assets/asset-1/download?redirect=1',
          }),
          { status: 201 },
        );
      }),
    );

    const progress: number[] = [];
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const result = await uploadPostAttachment(file, {
      projectId: 'project-1',
      postId: 'post-1',
      onProgress: (percent) => progress.push(percent),
    });

    expect(result).toEqual({
      attachmentId: 'attachment-1',
      assetId: 'asset-1',
      downloadUrl: '/api/v1/assets/asset-1/download?redirect=1',
    });
    expect(progress).toEqual([5, 90, 92, 100]);
    expect(calls.map(({ input }) => String(input))).toEqual([
      '/api/v1/project/assets',
      'https://storage.example.test/upload',
      '/api/v1/project/assets/asset-1/complete',
      '/api/v1/project/posts/post-1/attachments',
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      asset_kind: 'attachment',
      purpose: 'attachment',
      visibility: 'private',
      filename: 'notes.txt',
    });
  });

  it('stops when asset creation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'rejected' }), { status: 422 })),
    );

    await expect(
      uploadPostAttachment(new File(['hello'], 'notes.txt', { type: 'text/plain' }), {
        projectId: 'project-1',
        postId: 'post-1',
      }),
    ).rejects.toThrow('Attachment upload failed');
  });
});
