import { createHash } from 'node:crypto';

/** Content-addressed storage key: sha256 prefix + extension hint. */
export function contentAddressedKey(body: Uint8Array, extension = 'bin'): string {
  const hash = createHash('sha256').update(body).digest('hex');
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'bin';
  return `${hash.slice(0, 32)}/${hash}.${safeExt}`;
}

export function quarantineKey(uploadId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  return `pending/${uploadId}/${safeName}`;
}
