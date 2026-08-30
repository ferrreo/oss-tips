import { ProjectOwnershipRequestSchema, ProjectOwnershipSchema } from '@oss-tips/api-contracts';
import { getConfiguredOAuthProviders } from '$lib/server/auth';
import type { ProjectClaim } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { projectOwnership, readProjectManagement } from '../project-management';
import {
  verifyRepositoryOAuth,
  type RepositoryOAuthResult,
} from '$lib/server/project-verification';

class OwnershipStateChangedError extends Error {}

async function recordOwnershipState(
  db: ReturnType<typeof getDb>,
  event: Parameters<typeof auditRecord>[0],
  claimId: string,
  projectId: string,
  repositoryId: string | undefined,
  result: RepositoryOAuthResult,
  userId: string,
) {
  await db.transaction().execute(async (trx) => {
    const now = new Date();
    const updated = await trx
      .updateTable('project_claim')
      .set({
        ...(result.status === 'pending'
          ? {}
          : { status: result.status, reviewed_at: now, reviewed_by: null }),
        failure_reason: result.status === 'verified' ? null : result.reason,
        updated_at: now,
      })
      .where('id', '=', claimId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) throw new OwnershipStateChangedError();
    if (repositoryId && result.status !== 'pending') {
      await trx
        .updateTable('project_repository')
        .set({
          verification_status: result.status,
          verified_at: result.status === 'verified' ? now : null,
        })
        .where('id', '=', repositoryId)
        .where('project_id', '=', projectId)
        .execute();
    }
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId },
          {
            action:
              result.status === 'verified'
                ? 'project.ownership_verification.verified'
                : result.status === 'rejected'
                  ? 'project.ownership_verification.rejected'
                  : 'project.ownership_verification.pending',
            resourceType: 'project_claim',
            resourceId: claimId,
            projectId,
            metadata: { reason: result.status === 'verified' ? null : result.reason },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project_claim',
        aggregate_id: claimId,
        event_type: 'project.updated',
        payload: {
          project_id: projectId,
          claim_id: claimId,
          change: `verification_${result.status}`,
        },
        published_at: null,
      })
      .execute();
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorizeProject(event, getDb(), 'project.view_analytics', 'project:read');
  if (access instanceof Response) return access;
  const { project, claim } = await readProjectManagement(getDb(), access.projectId);
  if (!project) return problem(404, 'Project not found');
  return json(ProjectOwnershipSchema.parse(projectOwnership(claim)), {
    headers: { 'cache-control': 'private, no-store' },
  });
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.change_fee_mode', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectOwnershipRequestSchema);
  if (body instanceof Response) return body;

  const current = await readProjectManagement(db, access.projectId);
  if (!current.project) return problem(404, 'Project not found');
  if (body.method === 'repository_oauth' || body.method === 'repository_file') {
    if (!current.repository)
      return problem(
        400,
        'Repository required',
        'Add a repository before requesting ownership verification',
      );
    if (body.method === 'repository_file' && !body.proof_reference) {
      return problem(400, 'Proof required', 'Provide the repository file challenge reference');
    }
  }
  if (body.method === 'website_dns' && !current.project.website_url) {
    return problem(400, 'Website required', 'Add a website before requesting DNS verification');
  }

  const canRetryProvider =
    body.method === 'repository_oauth' &&
    current.claim?.status === 'pending' &&
    current.claim.method === 'repository_oauth';
  if (
    current.claim &&
    ['pending', 'manual_review'].includes(current.claim.status) &&
    !canRetryProvider
  ) {
    return problem(409, 'Verification already pending', 'Wait for the existing ownership review');
  }

  let linkedAccount:
    { access_token: string | null; access_token_expires_at: Date | null } | undefined;
  let providerPending: RepositoryOAuthResult | undefined;
  if (body.method === 'repository_oauth') {
    const provider = current.repository?.provider ?? '';
    const configured = getConfiguredOAuthProviders().some((item) => item === provider);
    if (!configured) {
      providerPending = {
        status: 'pending',
        reason: 'Provider OAuth is not configured; use a manual proof flow',
      };
    } else {
      linkedAccount = await db
        .selectFrom('account')
        .select(['access_token', 'access_token_expires_at'])
        .where('user_id', '=', access.userId)
        .where('provider_id', '=', provider)
        .orderBy('updated_at', 'desc')
        .executeTakeFirst();
      if (!linkedAccount?.access_token) {
        providerPending = {
          status: 'pending',
          reason: 'Link the repository provider account before retrying',
        };
      } else if (
        linkedAccount.access_token_expires_at &&
        linkedAccount.access_token_expires_at <= new Date()
      ) {
        providerPending = {
          status: 'pending',
          reason: 'Repository provider authorization has expired',
        };
      }
    }
  }

  let claim: ProjectClaim;
  try {
    claim = await db.transaction().execute(async (trx) => {
      const row =
        canRetryProvider && current.claim
          ? await trx
              .updateTable('project_claim')
              .set({
                user_id: access.userId,
                email: event.locals.session?.user.email ?? '',
                status: 'pending',
                method: body.method,
                proof_reference: body.proof_reference ?? null,
                reviewed_by: null,
                reviewed_at: null,
                failure_reason: null,
                updated_at: new Date(),
              })
              .where('id', '=', current.claim.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          : await trx
              .insertInto('project_claim')
              .values({
                id: uuidv7(),
                project_id: access.projectId,
                user_id: access.userId,
                email: event.locals.session?.user.email ?? '',
                status: 'pending',
                method: body.method,
                proof_reference: body.proof_reference ?? null,
                reviewed_by: null,
                reviewed_at: null,
                failure_reason: null,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'project.ownership_verification_requested',
              resourceType: 'project_claim',
              resourceId: row.id,
              projectId: access.projectId,
              metadata: { method: body.method },
            },
          ),
        )
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project_claim',
          aggregate_id: row.id,
          event_type: 'project.updated',
          payload: {
            project_id: access.projectId,
            claim_id: row.id,
            change: 'verification_requested',
          },
          published_at: null,
        })
        .execute();
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return problem(409, 'Verification already pending', 'Wait for the existing ownership review');
    }
    throw error;
  }

  const providerResult =
    providerPending ??
    (body.method === 'repository_oauth' && linkedAccount?.access_token && current.repository
      ? await verifyRepositoryOAuth({
          provider: current.repository.provider,
          url: current.repository.url,
          externalId: current.repository.external_id,
          accessToken: linkedAccount.access_token,
        })
      : undefined);
  if (providerResult) {
    try {
      await recordOwnershipState(
        db,
        event,
        claim.id,
        access.projectId,
        current.repository?.id,
        providerResult,
        access.userId,
      );
    } catch (error) {
      if (error instanceof OwnershipStateChangedError) {
        return problem(
          409,
          'Verification state changed',
          'Refresh ownership status and retry if needed',
        );
      }
      throw error;
    }
    const updated = await db
      .selectFrom('project_claim')
      .selectAll()
      .where('id', '=', claim.id)
      .executeTakeFirstOrThrow();
    return json(ProjectOwnershipSchema.parse(projectOwnership(updated)), {
      status:
        providerResult.status === 'verified'
          ? 200
          : providerResult.status === 'rejected'
            ? 422
            : 202,
      headers: { 'cache-control': 'private, no-store' },
    });
  }

  return json(ProjectOwnershipSchema.parse(projectOwnership(claim)), {
    status: 202,
    headers: { 'cache-control': 'private, no-store' },
  });
};
