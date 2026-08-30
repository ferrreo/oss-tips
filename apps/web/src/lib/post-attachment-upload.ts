export type PostAttachmentUploadOptions = {
  projectId: string;
  postId: string;
  onProgress?: (percent: number) => void;
};

export type UploadedPostAttachment = {
  attachmentId: string;
  assetId: string;
  downloadUrl: string;
};

type JsonRecord = Record<string, unknown>;

async function responseJson(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error('Attachment upload failed');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Attachment upload returned an invalid response');
  }
  return payload as JsonRecord;
}

function requiredString(payload: JsonRecord, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Attachment upload returned an invalid response');
  }
  return value;
}

function putFile(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  if (typeof XMLHttpRequest === 'undefined') {
    return fetch(url, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    }).then((response) => {
      if (!response.ok) throw new Error('Attachment upload failed');
      onProgress(80);
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url, true);
    request.setRequestHeader('content-type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 80));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(80);
        resolve();
      } else {
        reject(new Error('Attachment upload failed'));
      }
    };
    request.onerror = () => reject(new Error('Attachment upload failed'));
    request.onabort = () => reject(new Error('Attachment upload was cancelled'));
    request.send(file);
  });
}

export async function uploadPostAttachment(
  file: File,
  options: PostAttachmentUploadOptions,
): Promise<UploadedPostAttachment> {
  if (!file.size || !file.type) throw new Error('Attachment file is invalid');
  const progress = options.onProgress ?? (() => undefined);
  progress(5);
  const createResponse = await fetch('/api/v1/project/assets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-project-id': options.projectId,
    },
    body: JSON.stringify({
      asset_kind: 'attachment',
      purpose: 'attachment',
      visibility: 'private',
      content_type: file.type,
      content_length: file.size,
      filename: file.name,
    }),
  });
  const created = await responseJson(createResponse);
  const assetId = requiredString(created, 'id');
  const uploadUrl = requiredString(created, 'upload_url');
  const completeUrl = requiredString(created, 'complete_url');
  await putFile(uploadUrl, file, (percent) => progress(10 + percent));

  progress(92);
  const completeResponse = await fetch(completeUrl, {
    method: 'POST',
    headers: { 'x-project-id': options.projectId },
  });
  const completed = await responseJson(completeResponse);
  if (completed.status !== 'ready') throw new Error('Attachment upload is not ready');

  const attachResponse = await fetch(
    `/api/v1/project/posts/${encodeURIComponent(options.postId)}/attachments`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-project-id': options.projectId,
      },
      body: JSON.stringify({ asset_id: assetId }),
    },
  );
  const attached = await responseJson(attachResponse);
  const attachmentId = requiredString(attached, 'id');
  progress(100);
  return {
    attachmentId,
    assetId,
    downloadUrl:
      typeof attached.download_url === 'string' && attached.download_url.length > 0
        ? attached.download_url
        : `/api/v1/assets/${encodeURIComponent(assetId)}/download?redirect=1`,
  };
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
