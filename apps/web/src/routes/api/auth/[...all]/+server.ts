import { toSvelteKitHandler } from '@oss-tips/auth';
import type { RequestHandler } from './$types';
import { getAuth } from '$lib/server/auth';
import { hasDatabaseUrl } from '$lib/server/db';
import { problem } from '$lib/server/http';

const handle: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Auth unavailable', 'DATABASE_URL is required for Better Auth');
  }

  const auth = getAuth();
  const kitHandler = toSvelteKitHandler(auth);
  return kitHandler(event);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
