import { ProjectTeamMemberPatchSchema, ProjectTeamMemberSchema } from '@oss-tips/api-contracts';
import {
  checkProject,
  isProjectCapability,
  projectCapabilitiesForRole,
  type ProjectCapability,
  type ProjectRole,
} from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

const ROLES = ['owner', 'admin', 'finance', 'editor', 'community', 'analyst'] as const;
const RESTRICTED_CAPABILITIES = new Set<ProjectCapability>([
  'project.transfer_ownership',
  'project.delete',
  'project.connect_stripe',
]);

function nextCapabilities(
  role: ProjectRole,
  requested: string[] | undefined,
  actor: Parameters<typeof checkProject>[0],
  projectId: string,
): ProjectCapability[] | Response {
  const source = requested ?? [...projectCapabilitiesForRole(role)];
  const result: ProjectCapability[] = [];
  for (const capability of source) {
    if (!isProjectCapability(capability)) return problem(400, 'Invalid capability', capability);
    if (RESTRICTED_CAPABILITIES.has(capability))
      return problem(403, 'Capability cannot be delegated', capability);
    if (!checkProject(actor, capability, projectId).allowed) {
      return problem(403, 'Capability cannot be delegated', capability);
    }
    if (!result.includes(capability)) result.push(capability);
  }
  return result;
}

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_team', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectTeamMemberPatchSchema);
  if (body instanceof Response) return body;
  if (body.role === 'owner')
    return problem(400, 'Ownership transfer required', 'Use the ownership transfer workflow');
  if (body.role === undefined && body.capabilities === undefined)
    return problem(400, 'Empty team update');

  const current = await db
    .selectFrom('project_member')
    .innerJoin('user', 'user.id', 'project_member.user_id')
    .select([
      'project_member.id',
      'project_member.user_id',
      'user.name',
      'user.email',
      'project_member.role',
      'project_member.capabilities',
      'project_member.created_at',
      'project_member.updated_at',
    ])
    .where('project_member.id', '=', event.params.id)
    .where('project_member.project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!current) return problem(404, 'Team member not found');
  const role = (body.role ?? current.role) as ProjectRole;
  if (!ROLES.includes(role)) return problem(400, 'Invalid team role');
  const capabilities = nextCapabilities(role, body.capabilities, access.actor, access.projectId);
  if (capabilities instanceof Response) return capabilities;
  if (current.role === 'owner') return problem(409, 'Transfer ownership first');

  const member = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('project')
      .select('status')
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project) return { kind: 'not-found' as const };
    if (project.status === 'closed') return { kind: 'project-closed' as const };

    const row = await trx
      .updateTable('project_member')
      .set({ role, capabilities, updated_at: new Date() })
      .where('id', '=', current.id)
      .where('role', '<>', 'owner')
      .returning(['id', 'user_id', 'role', 'capabilities', 'created_at', 'updated_at'])
      .executeTakeFirst();
    if (!row) return { kind: 'owner' as const };
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.team_member.updated',
            resourceType: 'project_member',
            resourceId: row.id,
            projectId: access.projectId,
            metadata: { role, capabilities },
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
        payload: { project_id: access.projectId, member_id: row.id, change: 'team_member_updated' },
        published_at: null,
      })
      .execute();
    return { kind: 'updated' as const, row };
  });
  if (member.kind === 'not-found') return problem(404, 'Project not found');
  if (member.kind === 'project-closed') {
    return problem(409, 'Project is closed', 'Closed projects do not accept team member changes');
  }
  if (member.kind === 'owner') return problem(409, 'Transfer ownership first');
  return json(
    ProjectTeamMemberSchema.parse({
      id: member.row.id,
      user_id: member.row.user_id,
      name: current.name,
      email: current.email,
      role: member.row.role,
      capabilities: member.row.capabilities.filter(isProjectCapability),
      created_at: member.row.created_at.toISOString(),
      updated_at: member.row.updated_at.toISOString(),
    }),
    { headers: { 'cache-control': 'private, no-store' } },
  );
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_team', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const member = await db
    .selectFrom('project_member')
    .select(['id', 'role', 'user_id'])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!member) return problem(404, 'Team member not found');
  if (member.role === 'owner') return problem(409, 'Transfer ownership first');
  const removed = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('project')
      .select('status')
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project) return { kind: 'not-found' as const };
    if (project.status === 'closed') return { kind: 'project-closed' as const };

    const result = await trx
      .deleteFrom('project_member')
      .where('id', '=', member.id)
      .where('role', '<>', 'owner')
      .executeTakeFirst();
    if (Number(result.numDeletedRows) === 0) return { kind: 'owner' as const };
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.team_member.removed',
            resourceType: 'project_member',
            resourceId: member.id,
            projectId: access.projectId,
            metadata: { user_id: member.user_id },
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
          member_id: member.id,
          change: 'team_member_removed',
        },
        published_at: null,
      })
      .execute();
    return { kind: 'removed' as const };
  });
  if (removed.kind === 'not-found') return problem(404, 'Project not found');
  if (removed.kind === 'project-closed') {
    return problem(409, 'Project is closed', 'Closed projects do not accept team member changes');
  }
  if (removed.kind === 'owner') return problem(409, 'Transfer ownership first');
  return new Response(null, { status: 204 });
};
