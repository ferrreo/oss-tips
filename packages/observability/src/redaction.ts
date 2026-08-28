const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SIGNED_URL_RE = /(https?:\/\/[^\s]+(?:X-Amz-Signature|sig=|token=)[^\s]*)/gi;
const COOKIE_RE = /(?:^|;\s*)([^=]+)=([^;]*)/g;

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'stripe-signature',
  'oss-tips-signature',
]);

export function redactString(value: string): string {
  let out = value.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  out = out.replace(SIGNED_URL_RE, '[REDACTED_SIGNED_URL]');
  return out;
}

export function redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) {
      out[key] = '[REDACTED]';
    } else if (Array.isArray(raw)) {
      out[key] = redactString(raw.join(','));
    } else if (raw !== undefined) {
      out[key] = redactString(raw);
    }
  }
  return out;
}

export function redactBody(body: unknown): unknown {
  if (body === null || body === undefined) return body;
  if (typeof body === 'string') return redactString(body);
  if (typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower === 'email') {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactBody(v);
    }
  }
  return out;
}

export function redactCookieHeader(cookieHeader: string): string {
  return cookieHeader.replace(COOKIE_RE, (_m, name: string) => `${name}=[REDACTED]`);
}
