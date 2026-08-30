import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SUPPORT_EMAIL_VALUE_PREFIX = 'support-email:v2';

export function supportEmailIdentifier(projectId: string, email: string, secret: string): string {
  const emailHash = createHmac('sha256', secret).update(email, 'utf8').digest('hex');
  return `project-support-email:${projectId}:${emailHash}`;
}

function codeHash(identifier: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(`${identifier}:${code}`, 'utf8').digest('hex');
}

function derivedCode(identifier: string, nonce: string, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${identifier}:${nonce}:delivery`, 'utf8')
    .digest();
  return String(digest.readUIntBE(0, 6) % 1_000_000).padStart(6, '0');
}

/** Create a verifiable support-email value without storing the one-time code. */
export function createSupportEmailVerificationValue(
  identifier: string,
  secret: string,
): { value: string; code: string } {
  const nonce = randomBytes(16).toString('base64url');
  const code = derivedCode(identifier, nonce, secret);
  return {
    value: `${SUPPORT_EMAIL_VALUE_PREFIX}:${nonce}:${codeHash(identifier, code, secret)}`,
    code,
  };
}

/** Recover current code from structured value for delivery only. */
export function supportEmailCodeFromVerificationValue(
  identifier: string,
  storedValue: string,
  secret: string,
): string | null {
  const [, version, nonce, hash] = storedValue.split(':');
  if (
    version !== 'v2' ||
    !nonce ||
    !/^[A-Za-z0-9_-]{22}$/.test(nonce) ||
    !hash ||
    !/^[a-f0-9]{64}$/.test(hash)
  ) {
    return null;
  }
  const code = derivedCode(identifier, nonce, secret);
  return codeHash(identifier, code, secret) === hash ? code : null;
}

/** Compare submitted code with structured v2 or legacy hash-only value. */
export function supportEmailCodeMatches(
  identifier: string,
  code: string,
  storedValue: string,
  secret: string,
): boolean {
  const [, version, , structuredHash] = storedValue.split(':');
  const hash = version === 'v2' && structuredHash ? structuredHash : storedValue;
  const expected = Buffer.from(codeHash(identifier, code, secret), 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function supportEmailCodeHash(identifier: string, code: string, secret: string): string {
  return codeHash(identifier, code, secret);
}
