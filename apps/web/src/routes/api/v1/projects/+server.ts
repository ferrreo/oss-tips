import { ProjectListResponseSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { json } from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
  const cursor = url.searchParams.get('cursor');

  const payload = ProjectListResponseSchema.parse({
    data: [],
    next_cursor: cursor ? null : null,
  });

  return json(payload);
};
