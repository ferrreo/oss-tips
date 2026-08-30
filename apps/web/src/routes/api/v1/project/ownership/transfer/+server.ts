import {
  ProjectOwnershipTransferRequestSchema,
  ProjectOwnershipTransferSchema,
} from '@oss-tips/api-contracts';
import { authorizeProject, auditRecord, problem, readJson } from '../../../../api-utils';
import { projectCapabilitiesForRole } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';
import { json } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(
    event,
    db,
    'project.transfer_ownership',
    'project:write',
    true,
  );
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
  const body = await readJson(event.request, ProjectOwnershipTransferRequestSchema);
  if (body instanceof Response) return body;

  const result = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('project')
      .select(['id', 'status'])
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project) return { kind: 'missing' as const };

    const members = await trx
      .selectFrom('project_member')
      .innerJoin('user', 'user.id', 'project_member.user_id')
      .select([
        'project_member.id',
        'project_member.user_id',
        'project_member.role',
        'user.email',
        'user.email_verified',
      ])
      .where('project_member.project_id', '=', access.projectId)
      .forUpdate()
      .execute();
    const owners = members.filter((member) => member.role === 'owner');
    if (owners.length !== 1 || owners[0]?.user_id !== access.userId) {
      return { kind: 'conflict' as const, message: 'Project must have exactly one current owner' };
    }
    const targetEmail = body.email?.toLowerCase();
    const target = members.find((member) =>
      body.member_id ? member.id === body.member_id : member.email.toLowerCase() === targetEmail,
    );
    if (!target) return { kind: 'target_missing' as const };
    if (target.user_id === access.userId) return { kind: 'same_owner' as const };
    if (!target.email_verified) return { kind: 'target_unverified' as const };

    const now = new Date();
    await trx
      .updateTable('project_member')
      .set({
        role: 'owner',
        capabilities: [...projectCapabilitiesForRole('owner')],
        updated_at: now,
      })
      .where('id', '=', target.id)
      .execute();
    await trx
      .updateTable('project_member')
      .set({
        role: 'admin',
        capabilities: [...projectCapabilitiesForRole('admin')],
        updated_at: now,
      })
      .where('id', '=', owners[0].id)
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.ownership.transferred',
            resourceType: 'project',
            resourceId: access.projectId,
            projectId: access.projectId,
            metadata: { member_id: target.id, role: 'owner', user_id: target.user_id },
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
          member_id: target.id,
          change: 'ownership_transferred',
        },
        published_at: null,
      })
      .execute();
    return {
      kind: 'transferred' as const,
      project_id: access.projectId,
      previous_owner_id: access.userId,
      new_owner_id: target.user_id,
    };
  });

  if (result.kind === 'missing') return problem(404, 'Project not found');
  if (result.kind === 'target_missing') return problem(404, 'Team member not found');
  if (result.kind === 'same_owner') return problem(409, 'Choose another team member');
  if (result.kind === 'target_unverified') {
    return problem(409, 'Verified email required', 'The new owner must verify their email first');
  }
  if (result.kind === 'conflict') return problem(409, result.message);

  return json(
    ProjectOwnershipTransferSchema.parse({
      status: 'transferred',
      project_id: result.project_id,
      previous_owner_id: result.previous_owner_id,
      new_owner_id: result.new_owner_id,
    }),
    {
      headers: { 'cache-control': 'no-store' },
    },
  );
};
