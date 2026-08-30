import {
  ProjectClosureRequestSchema,
  ProjectClosureSchema,
  ProjectSettingsPatchSchema,
} from '@oss-tips/api-contracts';
import { checkProject } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import {
  lockStorageObjectKeys,
  normalizeEmailAddress,
  type Db,
  withEmailSuppressionLock,
} from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { normalizedList, projectSettings, readProjectManagement } from './project-management';
import { normalizeRepositoryUrl } from '$lib/server/project-verification';
import { softDeleteAssetIfUnreferenced } from '$lib/server/storage';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

function asMinor(value: { amount: string; currency: string } | null | undefined) {
  return value === null || value === undefined ? value : value.amount;
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorizeProject(event, getDb(), 'project.change_fee_mode', 'project:read');
  if (access instanceof Response) return access;
  if (!checkProject(access.actor, 'project.change_fee_mode', access.projectId).allowed) {
    return problem(403, 'Project access denied', 'missing_capability');
  }
  const payload = await projectSettings(getDb(), access.projectId);
  if (!payload) return problem(404, 'Project not found');
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};

export const PUT: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.change_fee_mode', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectSettingsPatchSchema);
  if (body instanceof Response) return body;
  if (Object.keys(body).length === 0) return problem(400, 'Empty project update');
  const normalizedRepository = body.repository && normalizeRepositoryUrl(body.repository.url);
  if (
    body.repository &&
    (!normalizedRepository ||
      normalizedRepository.provider !== body.repository.provider.toLowerCase() ||
      normalizedRepository.externalId !== body.repository.external_id)
  ) {
    return problem(
      400,
      'Invalid repository',
      'Provider and repository identity must match its URL',
    );
  }

  const current = await readProjectManagement(db, access.projectId);
  if (!current.project) return problem(404, 'Project not found');
  const currency = (body.default_currency ?? current.project.default_currency).toLowerCase();
  const min = asMinor(body.min_support);
  const max = asMinor(body.max_support);
  if (body.min_support && body.min_support.currency !== currency) {
    return problem(400, 'Invalid minimum support currency', `Use ${currency} for this project`);
  }
  if (body.max_support && body.max_support.currency !== currency) {
    return problem(400, 'Invalid maximum support currency', `Use ${currency} for this project`);
  }
  const currentMin =
    current.project.min_support_minor === null
      ? null
      : BigInt(String(current.project.min_support_minor));
  const currentMax =
    current.project.max_support_minor === null
      ? null
      : BigInt(String(current.project.max_support_minor));
  const nextMin = min === undefined ? currentMin : min === null ? null : BigInt(min);
  const nextMax = max === undefined ? currentMax : max === null ? null : BigInt(max);
  if (nextMin !== null && nextMin < 1n)
    return problem(400, 'Invalid minimum support', 'Minimum support must be positive');
  if (nextMax !== null && nextMax < 1n)
    return problem(400, 'Invalid maximum support', 'Maximum support must be positive');
  if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
    return problem(400, 'Invalid support limits', 'Minimum support cannot exceed maximum support');
  }

  const currentSupportEmail = current.project.support_email
    ? normalizeEmailAddress(current.project.support_email)
    : null;
  const nextSupportEmail =
    body.support_email === undefined
      ? currentSupportEmail
      : body.support_email
        ? normalizeEmailAddress(body.support_email)
        : null;
  const supportEmailChanged =
    body.support_email !== undefined && nextSupportEmail !== currentSupportEmail;

  for (const [field, assetId] of [
    ['logo_asset_id', body.logo_asset_id],
    ['banner_asset_id', body.banner_asset_id],
  ] as const) {
    if (!assetId) continue;
    const asset = await db
      .selectFrom('object_asset')
      .select(['id', 'purpose', 'project_id', 'soft_deleted_at', 'visibility', 'storage_key'])
      .where('id', '=', assetId)
      .executeTakeFirst();
    if (
      !asset ||
      asset.project_id !== access.projectId ||
      asset.soft_deleted_at ||
      asset.visibility !== 'public' ||
      asset.storage_key.startsWith('pending/')
    ) {
      return problem(
        400,
        `Invalid ${field}`,
        'Asset must be public, completed, and belong to this project',
      );
    }
    const allowedPurpose =
      field === 'logo_asset_id'
        ? asset.purpose === 'logo' || asset.purpose === 'avatar'
        : asset.purpose === 'banner';
    if (!allowedPurpose)
      return problem(400, `Invalid ${field}`, 'Asset purpose does not match project setting');
  }

  if (
    body.default_currency &&
    body.default_currency.toLowerCase() !== current.project.default_currency.toLowerCase()
  ) {
    const prices = await db
      .selectFrom('tier_price')
      .innerJoin('tier', 'tier.id', 'tier_price.tier_id')
      .select('tier_price.id')
      .where('tier.project_id', '=', access.projectId)
      .where('tier_price.is_active', '=', true)
      .executeTakeFirst();
    if (prices) return problem(409, 'Currency cannot change', 'Archive existing tier prices first');
  }

  const replacedAssetIds = [
    body.logo_asset_id !== undefined && body.logo_asset_id !== current.project.logo_asset_id
      ? current.project.logo_asset_id
      : null,
    body.banner_asset_id !== undefined && body.banner_asset_id !== current.project.banner_asset_id
      ? current.project.banner_asset_id
      : null,
  ].filter((assetId): assetId is string => assetId !== null);
  const assetIdsToLock = [
    ...replacedAssetIds,
    ...(body.logo_asset_id ? [body.logo_asset_id] : []),
    ...(body.banner_asset_id ? [body.banner_asset_id] : []),
  ];

  const updateProject = async (trx: Db) => {
    if (assetIdsToLock.length > 0) {
      const assets = await trx
        .selectFrom('object_asset')
        .select(['id', 'storage_key'])
        .where('id', 'in', [...new Set(assetIdsToLock)])
        .execute();
      await lockStorageObjectKeys(
        trx,
        assets.map(({ storage_key }) => storage_key),
      );
    }
    let demotedPublishedProject = false;
    if (body.support_email !== undefined && supportEmailChanged) {
      const lockedProject = await trx
        .selectFrom('project')
        .select(['support_email', 'status'])
        .where('id', '=', access.projectId)
        .forUpdate()
        .executeTakeFirst();
      const lockedSupportEmail = lockedProject?.support_email
        ? normalizeEmailAddress(lockedProject.support_email)
        : null;
      if (lockedSupportEmail !== currentSupportEmail) throw new SupportEmailChangedError();
      demotedPublishedProject = lockedProject?.status === 'published';
      await trx
        .deleteFrom('verification')
        .where('identifier', 'like', `project-support-email:${access.projectId}:%`)
        .execute();
    }
    await trx
      .updateTable('project')
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.default_currency !== undefined ? { default_currency: currency } : {}),
        ...(body.website_url !== undefined ? { website_url: body.website_url } : {}),
        ...(body.support_email !== undefined && supportEmailChanged
          ? {
              support_email: nextSupportEmail,
              support_email_verified_at: null,
              ...(demotedPublishedProject ? { status: 'draft' } : {}),
            }
          : {}),
        ...(body.open_source_declared !== undefined
          ? { open_source_declared: body.open_source_declared }
          : {}),
        ...(body.open_source_license !== undefined
          ? { open_source_license: body.open_source_license }
          : {}),
        ...(body.min_support !== undefined ? { min_support_minor: min } : {}),
        ...(body.max_support !== undefined ? { max_support_minor: max } : {}),
        ...(body.logo_asset_id !== undefined ? { logo_asset_id: body.logo_asset_id } : {}),
        ...(body.banner_asset_id !== undefined ? { banner_asset_id: body.banner_asset_id } : {}),
        ...(body.discovery?.ecosystems !== undefined
          ? { discovery_ecosystems: normalizedList(body.discovery.ecosystems) }
          : {}),
        ...(body.discovery?.languages !== undefined
          ? { discovery_languages: normalizedList(body.discovery.languages) }
          : {}),
        ...(body.discovery?.tags !== undefined
          ? { discovery_tags: normalizedList(body.discovery.tags) }
          : {}),
        updated_at: new Date(),
      })
      .where('id', '=', access.projectId)
      .execute();

    for (const assetId of replacedAssetIds) {
      await softDeleteAssetIfUnreferenced(trx, assetId);
    }

    if (demotedPublishedProject) {
      await trx
        .insertInto('project_status_history')
        .values({
          id: uuidv7(),
          project_id: access.projectId,
          from_status: 'published',
          to_status: 'draft',
          reason: 'support_email_changed',
          changed_by: access.userId,
        })
        .execute();
    }

    if (body.public_display) {
      await trx
        .updateTable('project')
        .set({
          ...(body.public_display.show_supporters === undefined
            ? {}
            : { public_show_supporters: body.public_display.show_supporters }),
          ...(body.public_display.show_goal === undefined
            ? {}
            : { public_show_goal: body.public_display.show_goal }),
          ...(body.public_display.show_stats === undefined
            ? {}
            : { public_show_stats: body.public_display.show_stats }),
          ...(body.public_display.show_gated_post_metadata === undefined
            ? {}
            : { public_show_gated_post_metadata: body.public_display.show_gated_post_metadata }),
          updated_at: new Date(),
        })
        .where('id', '=', access.projectId)
        .execute();
    }

    if (body.feature_mode) {
      const feature = await trx
        .selectFrom('project_feature_mode')
        .select('id')
        .where('project_id', '=', access.projectId)
        .executeTakeFirst();
      if (feature) {
        await trx
          .updateTable('project_feature_mode')
          .set({ mode: body.feature_mode, effective_at: new Date() })
          .where('id', '=', feature.id)
          .execute();
      } else {
        await trx
          .insertInto('project_feature_mode')
          .values({
            id: uuidv7(),
            project_id: access.projectId,
            mode: body.feature_mode,
            effective_at: new Date(),
          })
          .execute();
      }
    }

    if (body.repository !== undefined) {
      const existing = await trx
        .selectFrom('project_repository')
        .select(['id', 'provider', 'external_id'])
        .where('project_id', '=', access.projectId)
        .orderBy('created_at', 'asc')
        .executeTakeFirst();
      if (body.repository === null) {
        if (existing)
          await trx.deleteFrom('project_repository').where('id', '=', existing.id).execute();
      } else if (existing) {
        await trx
          .updateTable('project_repository')
          .set({
            provider: normalizedRepository?.provider ?? body.repository.provider.toLowerCase(),
            external_id: normalizedRepository?.externalId ?? body.repository.external_id,
            url: normalizedRepository?.url ?? body.repository.url,
            verification_status: 'pending',
            verified_at: null,
          })
          .where('id', '=', existing.id)
          .execute();
      } else {
        await trx
          .insertInto('project_repository')
          .values({
            id: uuidv7(),
            project_id: access.projectId,
            provider: normalizedRepository?.provider ?? body.repository.provider.toLowerCase(),
            external_id: normalizedRepository?.externalId ?? body.repository.external_id,
            url: normalizedRepository?.url ?? body.repository.url,
            verification_status: 'pending',
            verified_at: null,
          })
          .execute();
      }
    }

    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.updated',
            resourceType: 'project',
            resourceId: access.projectId,
            projectId: access.projectId,
            metadata: {
              fields: [...Object.keys(body), ...(demotedPublishedProject ? ['status'] : [])],
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
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: {
          project_id: access.projectId,
          fields: [...Object.keys(body), ...(demotedPublishedProject ? ['status'] : [])],
          ...(demotedPublishedProject ? { status: 'draft' } : {}),
        },
        published_at: null,
      })
      .execute();
  };

  try {
    if (supportEmailChanged && currentSupportEmail) {
      await withEmailSuppressionLock(db, currentSupportEmail, updateProject);
    } else {
      await db.transaction().execute(updateProject);
    }
  } catch (error) {
    if (error instanceof SupportEmailChangedError) {
      return problem(409, 'Support email changed', 'Reload project settings and try again');
    }
    throw error;
  }

  const payload = await projectSettings(db, access.projectId);
  if (!payload) return problem(404, 'Project not found');
  return json(payload, { headers: { 'cache-control': 'private, no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.delete', 'project:write', true);
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }
  const body = await readJson(event.request, ProjectClosureRequestSchema);
  if (body instanceof Response) return body;

  const result = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('project')
      .select(['id', 'status', 'closed_at', 'updated_at'])
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project) return { kind: 'missing' as const };
    if (project.status === 'closed') {
      return {
        kind: 'already_closed' as const,
        project_id: project.id,
        closed_at: project.closed_at ?? project.updated_at,
      };
    }

    const now = new Date();
    const [subscription, payment, checkout, domain, webhook, apiKey] = await Promise.all([
      trx
        .selectFrom('subscription')
        .select('id')
        .where('project_id', '=', project.id)
        .where((eb) =>
          eb.or([
            eb('status', 'in', ['active', 'past_due', 'grace', 'incomplete']),
            eb.and([eb('status', '=', 'cancelled'), eb('current_period_end', '>', now)]),
          ]),
        )
        .limit(1)
        .executeTakeFirst(),
      trx
        .selectFrom('payment')
        .select('id')
        .where('project_id', '=', project.id)
        .where('status', 'in', ['pending', 'processing'])
        .limit(1)
        .executeTakeFirst(),
      trx
        .selectFrom('checkout_intent')
        .leftJoin('payment', 'payment.id', 'checkout_intent.id')
        .select('checkout_intent.id')
        .where('checkout_intent.project_id', '=', project.id)
        .where('checkout_intent.expires_at', '>', now)
        .where((eb) =>
          eb.or([
            eb('payment.id', 'is', null),
            eb('payment.status', 'in', ['pending', 'processing']),
          ]),
        )
        .limit(1)
        .executeTakeFirst(),
      trx
        .selectFrom('custom_domain')
        .select('id')
        .where('project_id', '=', project.id)
        .where('status', '<>', 'removed')
        .limit(1)
        .executeTakeFirst(),
      trx
        .selectFrom('webhook_endpoint')
        .select('id')
        .where('project_id', '=', project.id)
        .where('is_active', '=', true)
        .limit(1)
        .executeTakeFirst(),
      trx
        .selectFrom('api_key')
        .select('id')
        .where('project_id', '=', project.id)
        .where('revoked_at', 'is', null)
        .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
        .limit(1)
        .executeTakeFirst(),
    ]);
    const blockers = [
      subscription ? 'active memberships' : null,
      payment || checkout ? 'pending payments' : null,
      domain ? 'custom domains' : null,
      webhook ? 'active webhooks' : null,
      apiKey ? 'active API keys' : null,
    ].filter((value): value is string => value !== null);
    if (blockers.length > 0) return { kind: 'blocked' as const, blockers };

    await trx
      .updateTable('project')
      .set({ status: 'closed', closed_at: now, updated_at: now })
      .where('id', '=', project.id)
      .execute();
    await trx
      .insertInto('project_status_history')
      .values({
        id: uuidv7(),
        project_id: project.id,
        from_status: project.status,
        to_status: 'closed',
        reason: 'owner_close',
        changed_by: access.userId,
      })
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.closed',
            resourceType: 'project',
            resourceId: project.id,
            projectId: project.id,
            metadata: { change: 'closed', status: 'closed' },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: project.id,
        event_type: 'project.closed',
        payload: { project_id: project.id, change: 'closed' },
        published_at: null,
      })
      .execute();
    return { kind: 'closed' as const, project_id: project.id, closed_at: now };
  });

  if (result.kind === 'missing') return problem(404, 'Project not found');
  if (result.kind === 'blocked') {
    return problem(
      409,
      'Project cannot be closed yet',
      `Resolve these first: ${result.blockers.join(', ')}`,
    );
  }
  return json(
    ProjectClosureSchema.parse({
      status: result.kind,
      project_id: result.project_id,
      closed_at: result.closed_at.toISOString(),
    }),
    { headers: { 'cache-control': 'no-store' } },
  );
};

class SupportEmailChangedError extends Error {}
