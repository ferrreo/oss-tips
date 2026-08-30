import { BUCKETS, type PresignedUrl, type StorageClient } from './types.js';
import { assertSafeObjectKey } from './keys.js';

export const MAX_PRIVATE_DOWNLOAD_TTL_SECONDS = 300;

export type PrivateAttachmentEntitlement = (input: { key: string }) => boolean | Promise<boolean>;

/** Entitlement check and signing stay adjacent so callers cannot sign private objects by bucket alone. */
export async function presignPrivateAttachment(
  storage: Pick<StorageClient, 'presignGet'>,
  key: string,
  canAccess: PrivateAttachmentEntitlement,
  ttlSeconds = MAX_PRIVATE_DOWNLOAD_TTL_SECONDS,
): Promise<PresignedUrl> {
  assertSafeObjectKey(key);
  if (key.startsWith('pending/')) throw new Error('Quarantine objects are not attachments');
  if (!(await canAccess({ key }))) throw new Error('Private attachment access denied');
  const ttl = Math.min(ttlSeconds, MAX_PRIVATE_DOWNLOAD_TTL_SECONDS);
  if (!Number.isSafeInteger(ttl) || ttl < 1) throw new Error('Private attachment TTL is invalid');
  return storage.presignGet(BUCKETS.privateContent, key, ttl);
}

export class PrivateAttachmentAccess {
  constructor(private readonly storage: Pick<StorageClient, 'presignGet'>) {}

  presign(
    key: string,
    canAccess: PrivateAttachmentEntitlement,
    ttlSeconds = MAX_PRIVATE_DOWNLOAD_TTL_SECONDS,
  ): Promise<PresignedUrl> {
    return presignPrivateAttachment(this.storage, key, canAccess, ttlSeconds);
  }
}
