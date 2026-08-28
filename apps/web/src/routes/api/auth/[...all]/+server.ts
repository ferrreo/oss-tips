import type { RequestHandler } from './$types';
import { json, problem } from '$lib/server/http';

/** Better Auth mount stub — wire to @oss-tips/auth handler in a later slice. */
export const GET: RequestHandler = async () => {
  return json({ auth: 'stub', provider: 'better-auth', status: 'not_configured' });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const segments = params.all?.split('/').filter(Boolean) ?? [];

  if (segments.length === 0) {
    return problem(404, 'Auth route not found');
  }

  const action = segments.join('/');
  const contentType = request.headers.get('content-type') ?? 'unknown';

  return json({
    auth: 'stub',
    action,
    method: 'POST',
    contentType,
    status: 'accepted',
  });
};

export const fallback: RequestHandler = async ({ request, params }) => {
  return problem(405, 'Method not allowed', `${request.method} on /api/auth/${params.all ?? ''}`);
};
