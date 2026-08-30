import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const API_KEY_PREFIX = 'oss_sk_';
const WEBHOOK_SECRET_PREFIX = 'whsec_';
const SCRYPT_KEY_BYTES = 32;

function deriveSecret(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, SCRYPT_KEY_BYTES, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
}

function encodeHash(secret: string): string {
  const salt = randomBytes(16);
  const digest = deriveSecret(secret, salt);
  return `scrypt:v1:${salt.toString('base64url')}:${digest.toString('base64url')}`;
}

function verifyHash(secret: string, encoded: string): boolean {
  const [scheme, version, saltText, digestText] = encoded.split(':');
  if (scheme !== 'scrypt' || version !== 'v1' || !saltText || !digestText) return false;

  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(digestText, 'base64url');
    const actual = deriveSecret(secret, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createApiKeySecret(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function apiKeyPrefix(secret: string): string {
  return secret.slice(0, API_KEY_PREFIX.length + 8);
}

export function hashApiKeySecret(secret: string): string {
  return encodeHash(secret);
}

export function verifyApiKeySecret(secret: string, encoded: string): boolean {
  return verifyHash(secret, encoded);
}

export function createWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
}

function encryptionKey(value: string): Buffer {
  const raw = value.startsWith('base64:')
    ? Buffer.from(value.slice('base64:'.length), 'base64')
    : /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
  if (raw.length !== 32) {
    throw new Error('Webhook encryption key must decode to 32 bytes');
  }
  return raw;
}

/** Encrypt a webhook secret for storage. The key is an application envelope key. */
export function encryptWebhookSecret(secret: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'enc',
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptWebhookSecret(encoded: string, key: string): string {
  const [scheme, version, ivText, tagText, ciphertextText] = encoded.split(':');
  if (scheme !== 'enc' || version !== 'v1' || !ivText || !tagText || !ciphertextText) {
    throw new Error('Unsupported webhook secret encoding');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(key),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Stable digest for an ETag without exposing payload data. */
export function hashForEtag(body: string): string {
  return `"${createHash('sha256').update(body).digest('hex')}"`;
}
