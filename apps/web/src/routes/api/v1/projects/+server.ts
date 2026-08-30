import { ProjectCreateSchema, ProjectListResponseSchema } from '@oss-tips/api-contracts';
import { projectCapabilitiesForRole } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  auditRecord,
  enforceApiRateLimit,
  hashApiRateLimitKey,
  json,
  jsonWithEtag,
  parsePage,
  problem,
  publicBaseUrl,
  readJson,
} from '../../api-utils';
import { toProjectSummary } from '../../public-api';
import { projectSettings } from '../project/project-management';
import { normalizeRepositoryUrl } from '$lib/server/project-verification';

type ProjectCursor = {
  searchRank: number;
  repositoryRank: number;
  descriptionRank: number;
  updatedAt: string;
  id: string;
};

const ORGANISATION_ADMIN_ROLES = new Set(['owner', 'admin']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

class OnboardingAccessError extends Error {}
class OnboardingUserUnavailableError extends Error {}

function normalizedList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function encodeCursor(cursor: ProjectCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): ProjectCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<ProjectCursor>;
    if (
      typeof parsed.searchRank !== 'number' ||
      !Number.isInteger(parsed.searchRank) ||
      typeof parsed.repositoryRank !== 'number' ||
      !Number.isInteger(parsed.repositoryRank) ||
      typeof parsed.descriptionRank !== 'number' ||
      !Number.isInteger(parsed.descriptionRank) ||
      typeof parsed.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.updatedAt)) ||
      typeof parsed.id !== 'string' ||
      parsed.id.length === 0
    ) {
      return null;
    }
    return parsed as ProjectCursor;
  } catch {
    return null;
  }
}

function normalizedSearchParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim().toLowerCase();
  return value ? value.slice(0, 120) : undefined;
}

export const GET: RequestHandler = async ({ request, url }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  }

  const page = parsePage(url);
  if (page instanceof Response) return page;
  const { limit, cursor: rawCursor } = page;
  const query = normalizedSearchParam(url, 'query');
  const tag = normalizedSearchParam(url, 'tag');
  const ecosystem = normalizedSearchParam(url, 'ecosystem');
  const language = normalizedSearchParam(url, 'language');
  const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
  if (rawCursor && !cursor) {
    return problem(400, 'Invalid pagination cursor', 'cursor is not a valid project keyset cursor');
  }

  const db = getDb();
  const ranked = db
    .selectFrom('project')
    .leftJoin('stripe_connected_account', 'stripe_connected_account.project_id', 'project.id')
    .select((eb) => {
      const repositoryExists = eb.exists(
        eb
          .selectFrom('project_repository as repository')
          .select('repository.id')
          .whereRef('repository.project_id', '=', 'project.id'),
      );
      const exactRepository = query
        ? eb.exists(
            eb
              .selectFrom('project_repository as repository')
              .select('repository.id')
              .whereRef('repository.project_id', '=', 'project.id')
              .where((repositoryEb) =>
                repositoryEb.or([
                  repositoryEb('repository.url', 'ilike', query),
                  repositoryEb('repository.external_id', 'ilike', query),
                ]),
              ),
          )
        : eb.val(false);
      const repositoryMatch = query
        ? eb.exists(
            eb
              .selectFrom('project_repository as repository')
              .select('repository.id')
              .whereRef('repository.project_id', '=', 'project.id')
              .where((repositoryEb) =>
                repositoryEb.or([
                  repositoryEb('repository.url', 'ilike', `%${query}%`),
                  repositoryEb('repository.external_id', 'ilike', `%${query}%`),
                ]),
              ),
          )
        : eb.val(false);
      const nameExact = query ? eb('project.name', 'ilike', query) : eb.val(false);
      const namePrefix = query ? eb('project.name', 'ilike', `${query}%`) : eb.val(false);
      const nameContains = query ? eb('project.name', 'ilike', `%${query}%`) : eb.val(false);
      const descriptionContains = query
        ? eb('project.description', 'ilike', `%${query}%`)
        : eb.val(false);
      const taxonomyMatch = query
        ? eb.or([
            eb('project.discovery_tags', '@>', [query]),
            eb('project.discovery_ecosystems', '@>', [query]),
            eb('project.discovery_languages', '@>', [query]),
          ])
        : eb.val(false);

      return [
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
        eb
          .case()
          .when(nameExact)
          .then(500)
          .when(exactRepository)
          .then(450)
          .when(namePrefix)
          .then(300)
          .when(repositoryMatch)
          .then(250)
          .when(nameContains)
          .then(200)
          .when(taxonomyMatch)
          .then(180)
          .when(descriptionContains)
          .then(100)
          .else(0)
          .end()
          .as('search_rank'),
        eb.case().when(repositoryExists).then(1).else(0).end().as('repository_rank'),
        eb
          .case()
          .when('project.description', 'is not', null)
          .then(1)
          .else(0)
          .end()
          .as('description_rank'),
      ];
    })
    .where('project.status', '=', 'published')
    .where((eb) => {
      const conditions = [];
      if (query) {
        conditions.push(
          eb.or([
            eb('project.name', 'ilike', `%${query}%`),
            eb('project.description', 'ilike', `%${query}%`),
            eb.exists(
              eb
                .selectFrom('project_repository as repository')
                .select('repository.id')
                .whereRef('repository.project_id', '=', 'project.id')
                .where((repositoryEb) =>
                  repositoryEb.or([
                    repositoryEb('repository.url', 'ilike', `%${query}%`),
                    repositoryEb('repository.external_id', 'ilike', `%${query}%`),
                  ]),
                ),
            ),
          ]),
        );
      }
      if (tag) {
        conditions.push(
          eb.or([
            eb('project.discovery_tags', '@>', [tag]),
            eb('project.discovery_ecosystems', '@>', [tag]),
            eb('project.discovery_languages', '@>', [tag]),
            eb.exists(
              eb
                .selectFrom('project_repository as repository')
                .select('repository.id')
                .whereRef('repository.project_id', '=', 'project.id')
                .where('repository.provider', 'ilike', tag),
            ),
          ]),
        );
      }
      if (ecosystem) {
        conditions.push(eb('project.discovery_ecosystems', '@>', [ecosystem]));
      }
      if (language) {
        conditions.push(eb('project.discovery_languages', '@>', [language]));
      }
      return conditions.length === 0 ? eb.val(true) : eb.and(conditions);
    });

  let projects = db
    .selectFrom(ranked.as('ranked'))
    .select([
      'ranked.id',
      'ranked.slug',
      'ranked.name',
      'ranked.description',
      'ranked.status',
      'ranked.default_currency',
      'ranked.updated_at',
      'ranked.website_url',
      'ranked.logo_asset_id',
      'ranked.banner_asset_id',
      'ranked.discovery_ecosystems',
      'ranked.discovery_languages',
      'ranked.discovery_tags',
      'ranked.stripe_account_id',
      'ranked.charges_enabled',
      'ranked.payouts_enabled',
      'ranked.capabilities',
      'ranked.search_rank',
      'ranked.repository_rank',
      'ranked.description_rank',
    ])
    .orderBy('ranked.search_rank', 'desc')
    .orderBy('ranked.repository_rank', 'desc')
    .orderBy('ranked.description_rank', 'desc')
    .orderBy('ranked.updated_at', 'desc')
    .orderBy('ranked.id', 'desc');

  if (cursor) {
    projects = projects.where((eb) =>
      eb.or([
        eb('ranked.search_rank', '<', cursor.searchRank),
        eb.and([
          eb('ranked.search_rank', '=', cursor.searchRank),
          eb('ranked.repository_rank', '<', cursor.repositoryRank),
        ]),
        eb.and([
          eb('ranked.search_rank', '=', cursor.searchRank),
          eb('ranked.repository_rank', '=', cursor.repositoryRank),
          eb('ranked.description_rank', '<', cursor.descriptionRank),
        ]),
        eb.and([
          eb('ranked.search_rank', '=', cursor.searchRank),
          eb('ranked.repository_rank', '=', cursor.repositoryRank),
          eb('ranked.description_rank', '=', cursor.descriptionRank),
          eb('ranked.updated_at', '<', new Date(cursor.updatedAt)),
        ]),
        eb.and([
          eb('ranked.search_rank', '=', cursor.searchRank),
          eb('ranked.repository_rank', '=', cursor.repositoryRank),
          eb('ranked.description_rank', '=', cursor.descriptionRank),
          eb('ranked.updated_at', '=', new Date(cursor.updatedAt)),
          eb('ranked.id', '<', cursor.id),
        ]),
      ]),
    );
  }

  const rows = await projects.limit(limit + 1).execute();
  const pageRows = rows.slice(0, limit);
  const repositories = pageRows.length
    ? await db
        .selectFrom('project_repository')
        .select(['project_id', 'provider', 'url'])
        .where(
          'project_id',
          'in',
          pageRows.map((row) => row.id),
        )
        .orderBy('created_at', 'asc')
        .execute()
    : [];
  const tagsByProject = new Map<string, string[]>();
  const repositoryUrlsByProject = new Map<string, string>();
  for (const repository of repositories) {
    const tags = tagsByProject.get(repository.project_id) ?? [];
    const provider = repository.provider.trim().toLowerCase();
    if (provider && !tags.includes(provider)) tags.push(provider);
    tagsByProject.set(repository.project_id, tags);
    if (!repositoryUrlsByProject.has(repository.project_id)) {
      repositoryUrlsByProject.set(repository.project_id, repository.url);
    }
  }

  const baseUrl = publicBaseUrl(url);
  const payload = ProjectListResponseSchema.parse({
    data: pageRows.map((row) =>
      toProjectSummary(
        row,
        baseUrl,
        row,
        tagsByProject.get(row.id) ?? [],
        repositoryUrlsByProject.get(row.id) ?? null,
      ),
    ),
    next_cursor:
      rows.length > limit && pageRows[pageRows.length - 1]
        ? encodeCursor({
            searchRank: Number(pageRows[pageRows.length - 1].search_rank),
            repositoryRank: Number(pageRows[pageRows.length - 1].repository_rank),
            descriptionRank: Number(pageRows[pageRows.length - 1].description_rank),
            updatedAt: pageRows[pageRows.length - 1].updated_at.toISOString(),
            id: pageRows[pageRows.length - 1].id,
          })
        : null,
  });

  return jsonWithEtag(request, payload);
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = event.locals.session;
  if (!session) return problem(401, 'Authentication required');
  if (!session.user.emailVerified) {
    return problem(
      403,
      'Verified account required',
      'Verify your sign-in email before creating a project',
    );
  }

  const body = await readJson(event.request, ProjectCreateSchema);
  if (body instanceof Response) return body;
  if (body.organisation_id && !UUID.test(body.organisation_id)) {
    return problem(400, 'Invalid organisation id');
  }
  const repository = normalizeRepositoryUrl(body.repository_url);
  if (!repository) {
    return problem(
      400,
      'Invalid repository URL',
      'Use a public repository URL with an owner and name',
    );
  }

  const db = getDb();
  const rateLimit = await enforceApiRateLimit(event, db, {
    kind: 'session',
    key: hashApiRateLimitKey(`session:${session.user.id}`),
  });
  if (rateLimit) return rateLimit;
  if (body.organisation_id) {
    const membership = await db
      .selectFrom('organisation_member')
      .select('role')
      .where('organisation_id', '=', body.organisation_id)
      .where('user_id', '=', session.user.id)
      .executeTakeFirst();
    if (!membership || !ORGANISATION_ADMIN_ROLES.has(membership.role)) {
      return problem(
        403,
        'Organisation access denied',
        'You need organisation owner or admin access',
      );
    }
  }

  const projectId = uuidv7();
  try {
    await db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('user')
        .select('id')
        .where('id', '=', session.user.id)
        .forUpdate()
        .executeTakeFirst();
      if (!user) throw new OnboardingUserUnavailableError();

      const organisationId = body.organisation_id ?? uuidv7();
      if (!body.organisation_id) {
        await trx
          .insertInto('organisation')
          .values({
            id: organisationId,
            name: body.organisation_name ?? body.name,
            slug: `${body.slug}-${organisationId.replaceAll('-', '').slice(-8)}`,
          })
          .execute();
        await trx
          .insertInto('organisation_member')
          .values({
            id: uuidv7(),
            organisation_id: organisationId,
            user_id: session.user.id,
            role: 'owner',
          })
          .execute();
      } else {
        const membership = await trx
          .selectFrom('organisation_member')
          .select('role')
          .where('organisation_id', '=', organisationId)
          .where('user_id', '=', session.user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!membership || !ORGANISATION_ADMIN_ROLES.has(membership.role)) {
          throw new OnboardingAccessError();
        }
      }

      await trx
        .insertInto('project')
        .values({
          id: projectId,
          organisation_id: organisationId,
          name: body.name,
          slug: body.slug,
          status: 'draft',
          description: body.description,
          default_currency: body.default_currency,
          website_url: body.website_url,
          support_email: body.support_email.toLowerCase(),
          open_source_declared: body.open_source_declared,
          open_source_license: body.open_source_license ?? null,
          discovery_ecosystems: normalizedList(body.discovery.ecosystems),
          discovery_languages: normalizedList(body.discovery.languages),
          discovery_tags: normalizedList(body.discovery.tags),
        })
        .execute();
      await trx
        .insertInto('project_member')
        .values({
          id: uuidv7(),
          project_id: projectId,
          user_id: session.user.id,
          role: 'owner',
          capabilities: [...projectCapabilitiesForRole('owner')],
        })
        .execute();
      await trx
        .insertInto('project_repository')
        .values({
          id: uuidv7(),
          project_id: projectId,
          provider: repository.provider,
          external_id: repository.externalId,
          url: repository.url,
          verification_status: 'pending',
          verified_at: null,
        })
        .execute();
      await trx
        .insertInto('project_feature_mode')
        .values({
          id: uuidv7(),
          project_id: projectId,
          mode: 'standard',
          effective_at: new Date(),
        })
        .execute();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: session.user.id },
            {
              action: 'project.created',
              resourceType: 'project',
              resourceId: projectId,
              projectId,
              metadata: {
                organisation_id: organisationId,
                repository_provider: repository.provider,
              },
            },
          ),
        )
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: projectId,
          event_type: 'project.updated',
          payload: { project_id: projectId, change: 'created' },
          published_at: null,
        })
        .execute();
    });
  } catch (error) {
    if (error instanceof OnboardingUserUnavailableError) {
      return problem(409, 'Account unavailable', 'Your account is being deleted');
    }
    if (error instanceof OnboardingAccessError) {
      return problem(
        403,
        'Organisation access denied',
        'You need organisation owner or admin access',
      );
    }
    if (isUniqueViolation(error)) {
      return problem(
        409,
        'Project already exists',
        'Choose a different project slug or repository',
      );
    }
    throw error;
  }

  const settings = await projectSettings(db, projectId);
  if (!settings) return problem(500, 'Project could not be loaded');
  return json(settings, {
    status: 201,
    headers: {
      'cache-control': 'private, no-store',
      location: `/api/v1/project?project_id=${encodeURIComponent(projectId)}`,
    },
  });
};
