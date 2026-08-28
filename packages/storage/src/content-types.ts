/** Reject executables, HTML, and other dangerous content types. */
const BLOCKED_EXACT = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/javascript',
  'text/javascript',
  'application/xhtml+xml',
  'image/svg+xml',
]);

const BLOCKED_PREFIXES = ['text/html', 'application/x-httpd', 'application/vnd.microsoft.portable-executable'];

export function isDangerousContentType(contentType: string): boolean {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!normalized) return true;
  if (BLOCKED_EXACT.has(normalized)) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (normalized.startsWith(prefix)) return true;
  }
  return false;
}

export function assertSafeContentType(contentType: string): void {
  if (isDangerousContentType(contentType)) {
    throw new Error(`Rejected content type: ${contentType}`);
  }
}
