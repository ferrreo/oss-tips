export class DiscordApiError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'DiscordApiError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isRetryableDiscordError(error: unknown): boolean {
  if (!(error instanceof DiscordApiError)) return false;
  return error.status === 403 || error.status === 429 || error.status >= 500;
}

export function retryAt(error: unknown, now = new Date()): Date {
  const delay =
    error instanceof DiscordApiError && error.retryAfterMs != null ? error.retryAfterMs : 30_000;
  return new Date(now.getTime() + Math.max(1_000, delay));
}
