import type { RequestHandler } from './$types';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    service: '@oss-tips/web',
    timestamp: new Date().toISOString(),
  });
};
