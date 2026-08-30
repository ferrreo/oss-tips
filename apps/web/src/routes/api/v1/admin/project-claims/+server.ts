import {
  ProjectOwnershipReviewListSchema,
  ProjectOwnershipReviewSchema,
} from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { requirePlatformReviewer } from '$lib/server/admin-api';
import { projectOwnership } from '../../project/project-management';
import { problem } from '../../../api-utils';

const REVIEW_STATUSES = ['pending', 'manual_review', 'rejected', 'verified'] as const;

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const reviewer = requirePlatformReviewer(event);
  if (reviewer instanceof Response) return reviewer;
  const rawStatus = event.url.searchParams.get('status');
  if (rawStatus && !REVIEW_STATUSES.includes(rawStatus as (typeof REVIEW_STATUSES)[number])) {
    return problem(400, 'Invalid review status');
  }
  const db = getDb();
  const rows = await db
    .selectFrom('project_claim')
    .innerJoin('project', 'project.id', 'project_claim.project_id')
    .leftJoin('project_repository', 'project_repository.project_id', 'project.id')
    .select([
      'project_claim.id as claim_id',
      'project_claim.project_id',
      'project_claim.user_id',
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
    .$if(Boolean(rawStatus), (query) =>
      query.where('project_claim.status', '=', rawStatus as string),
    )
    .$if(!rawStatus, (query) =>
      query.where('project_claim.status', 'in', ['pending', 'manual_review']),
    )
    .orderBy('project_claim.updated_at', 'asc')
    .limit(100)
    .execute();

  const data = rows.map((row) =>
    ProjectOwnershipReviewSchema.parse({
      ...projectOwnership({
        id: row.claim_id,
        project_id: row.project_id,
        user_id: row.user_id,
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
      repository_url: row.repository_url ?? null,
    }),
  );
  return json(ProjectOwnershipReviewListSchema.parse({ data }), {
    headers: { 'cache-control': 'private, no-store' },
  });
};
