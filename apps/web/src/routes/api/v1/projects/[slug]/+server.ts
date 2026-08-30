import { ProjectSummarySchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { jsonWithEtag, problem, publicBaseUrl } from '../../../api-utils';
import { toProjectSummary } from '../../../public-api';

export const GET: RequestHandler = async ({ params, request, url }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug) return problem(400, 'Missing project slug');

  const db = getDb();
  const row = await db
    .selectFrom('project')
    .leftJoin('stripe_connected_account', 'stripe_connected_account.project_id', 'project.id')
    .select([
      'project.id',
      'project.slug',
      'project.name',
      'project.description',
      'project.status',
      'project.default_currency',
      'project.updated_at',
      'project.website_url',
      'project.logo_asset_id',
      'project.banner_asset_id',
      'project.discovery_ecosystems',
      'project.discovery_languages',
      'project.discovery_tags',
      'stripe_connected_account.stripe_account_id',
      'stripe_connected_account.charges_enabled',
      'stripe_connected_account.payouts_enabled',
      'stripe_connected_account.capabilities',
    ])
    .where('project.slug', '=', params.slug)
    .where('project.status', '=', 'published')
    .executeTakeFirst();
  if (!row) return problem(404, 'Project not found');

  const repositories = await db
    .selectFrom('project_repository')
    .select(['provider', 'url'])
    .where('project_id', '=', row.id)
    .orderBy('created_at', 'asc')
    .execute();
  const tags = [
    ...new Set(
      repositories.map((repository) => repository.provider.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const repositoryUrl = repositories[0]?.url ?? null;

  const payload = ProjectSummarySchema.parse(
    toProjectSummary(row, publicBaseUrl(url), row, tags, repositoryUrl),
  );
  return jsonWithEtag(request, payload);
};
