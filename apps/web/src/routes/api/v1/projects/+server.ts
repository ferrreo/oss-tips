import { ProjectListResponseSchema } from '@oss-tips/api-contracts';
import { createProjectsRepository } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  }

  const cursor = url.searchParams.get('cursor') ?? undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const baseUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';

  const projects = createProjectsRepository(getDb());
  const rows = await projects.listPublished(limit, cursor);

  const payload = ProjectListResponseSchema.parse({
    data: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      canonical_url: `${baseUrl.replace(/\/$/, '')}/${row.slug}`,
      payment_status: 'pending' as const,
      tags: [],
      updated_at: row.updated_at.toISOString(),
    })),
    next_cursor:
      rows.length === limit ? rows[rows.length - 1]?.updated_at.toISOString() ?? null : null,
  });

  return json(payload);
};
