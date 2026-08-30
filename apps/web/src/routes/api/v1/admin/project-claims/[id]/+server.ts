import {
  ProjectOwnershipReviewDecisionSchema,
  ProjectOwnershipReviewSchema,
} from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { requirePlatformReviewer } from '$lib/server/admin-api';
import { auditRecord, problem, readJson } from '../../../../api-utils';
import { projectOwnership } from '../../../project/project-management';

function reviewItem(row: {
  claim_id: string;
  project_id: string;
  email: string;
  status: string;
  method: string;
  proof_reference: string | null;
  failure_reason: string | null;
  updated_at: Date;
  project_slug: string;
  project_name: string;
  repository_url: string | null;
}) {
  return ProjectOwnershipReviewSchema.parse({
    ...projectOwnership({
      id: row.claim_id,
      project_id: row.project_id,
      user_id: null,
      email: row.email,
      status: row.status,
      method: row.method,
      proof_reference: row.proof_reference,
      failure_reason: row.failure_reason,
      reviewed_by: null,
      reviewed_at: null,
      created_at: row.updated_at,
      updated_at: row.updated_at,
    }),
    claim_id: row.claim_id,
    project_id: row.project_id,
    project_slug: row.project_slug,
    project_name: row.project_name,
    email: row.email,
    repository_url: row.repository_url,
  });
}

async function loadReview(db: ReturnType<typeof getDb>, claimId: string) {
  return db
    .selectFrom('project_claim')
    .innerJoin('project', 'project.id', 'project_claim.project_id')
    .leftJoin('project_repository', 'project_repository.project_id', 'project.id')
    .select([
      'project_claim.id as claim_id',
      'project_claim.project_id',
      'project_claim.email',
      'project_claim.status',
      'project_claim.method',
      'project_claim.proof_reference',
      'project_claim.failure_reason',
      'project_claim.updated_at',
      'project.slug as project_slug',
      'project.name as project_name',
      'project_repository.url as repository_url',
    ])
    .where('project_claim.id', '=', claimId)
    .executeTakeFirst();
}

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const reviewer = requirePlatformReviewer(event);
  if (reviewer instanceof Response) return reviewer;
  const body = await readJson(event.request, ProjectOwnershipReviewDecisionSchema);
  if (body instanceof Response) return body;
  const db = getDb();

  try {
    await db.transaction().execute(async (trx) => {
      const claim = await trx
        .selectFrom('project_claim')
        .selectAll()
        .where('id', '=', event.params.id)
        .forUpdate()
        .executeTakeFirst();
      if (!claim) throw new ReviewRouteError(404, 'Ownership claim not found');
      if (!['pending', 'manual_review'].includes(claim.status)) {
        throw new ReviewRouteError(409, 'Ownership claim is already decided');
      }

      const now = new Date();
      const status =
        body.decision === 'approve'
          ? 'verified'
          : body.decision === 'reject'
            ? 'rejected'
            : 'manual_review';
      const updated = await trx
        .updateTable('project_claim')
        .set({
          status,
          reviewed_by: reviewer.userId,
          reviewed_at: now,
          failure_reason: status === 'verified' ? null : body.reason,
          updated_at: now,
        })
        .where('id', '=', claim.id)
        .where('status', '=', claim.status)
        .execute();
      if (updated[0]?.numUpdatedRows === 0n) {
        throw new ReviewRouteError(409, 'Ownership claim changed; retry this review');
      }
      if (claim.method === 'repository_oauth' || claim.method === 'repository_file') {
        await trx
          .updateTable('project_repository')
          .set({
            verification_status:
              status === 'verified' ? 'verified' : status === 'rejected' ? 'failed' : 'pending',
            verified_at: status === 'verified' ? now : null,
          })
          .where('project_id', '=', claim.project_id)
          .execute();
      }
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: reviewer.userId },
            {
              action: `project.ownership_review.${body.decision}`,
              resourceType: 'project_claim',
              resourceId: claim.id,
              projectId: claim.project_id,
              metadata: { reason: body.reason, from_status: claim.status, to_status: status },
            },
          ),
        )
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project_claim',
          aggregate_id: claim.id,
          event_type: 'project.updated',
          payload: {
            project_id: claim.project_id,
            claim_id: claim.id,
            change: `review_${body.decision}`,
          },
          published_at: null,
        })
        .execute();
    });
  } catch (error) {
    if (error instanceof ReviewRouteError) return problem(error.status, error.message);
    throw error;
  }

  const row = await loadReview(db, event.params.id);
  if (!row) return problem(404, 'Ownership claim not found');
  return json(reviewItem(row), { headers: { 'cache-control': 'private, no-store' } });
};

class ReviewRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
