export async function projectApi<T>(
  path: string,
  init: RequestInit = {},
  fallback = 'Request could not be completed.',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error(fallback);
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(fallback);
  return body as T;
}

export type PublicAnalyticsEvent = 'page_view' | 'support_composer_open';

/** Record one coarse public funnel event without exposing identifiers to the API. */
export async function recordPublicAnalyticsEvent(
  projectSlug: string,
  event: PublicAnalyticsEvent,
): Promise<void> {
  await projectApi(`/api/v1/projects/${encodeURIComponent(projectSlug)}/analytics/events`, {
    method: 'POST',
    keepalive: true,
    headers: { 'idempotency-key': globalThis.crypto.randomUUID() },
    body: JSON.stringify({ event, referrer: document.referrer || null }),
  });
}
