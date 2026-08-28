import type { ProblemDetails } from '@oss-tips/api-contracts';

export function json<T>(body: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function problem(
  status: number,
  title: string,
  detail?: string,
  init: ResponseInit = {},
): Response {
  const body: ProblemDetails = {
    type: 'about:blank',
    title,
    status,
    ...(detail ? { detail } : {}),
  };
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/problem+json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}
