import {
  ProjectTeamInviteCreateSchema,
  ProjectTeamInviteSchema,
  ProjectTeamMemberPatchSchema,
  ProjectTeamMemberSchema,
  ProjectTeamSchema,
} from '@oss-tips/api-contracts';
import {
  checkProject,
  isProjectCapability,
  projectCapabilitiesForRole,
  type ProjectCapability,
  type ProjectRole,
} from '@oss-tips/auth';
import { emailNotificationJob } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

const PROJECT_ROLES = ['owner', 'admin', 'finance', 'editor', 'community', 'analyst'] as const;
const INVITE_ROLES = ['admin', 'finance', 'editor', 'community', 'analyst'] as const;
const RESTRICTED_CAPABILITIES = new Set<ProjectCapability>([
  'project.transfer_ownership',
  'project.delete',
  'project.connect_stripe',
]);

function capabilitiesFor(
  role: ProjectRole,
  requested: string[] | undefined,
  actor: Parameters<typeof checkProject>[0],
  projectId: string,
): ProjectCapability[] | Response {
  const capabilities = requested ?? [...projectCapabilitiesForRole(role)];
  const result: ProjectCapability[] = [];
  for (const capability of capabilities) {
    if (!isProjectCapability(capability)) return problem(400, 'Invalid capability', capability);
    if (RESTRICTED_CAPABILITIES.has(capability)) {
      return problem(403, 'Capability cannot be delegated', capability);
    }
    if (!checkProject(actor, capability, projectId).allowed) {
      return problem(403, 'Capability cannot be delegated', capability);
    }
    if (!result.includes(capability)) result.push(capability);
  }
  return result;
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_team', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const [members, invites] = await Promise.all([
    db
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
      .where('project_member.project_id', '=', access.projectId)
      .orderBy('project_member.created_at', 'asc')
      .execute(),
    db
      .selectFrom('project_team_invite')
      .select(['id', 'email', 'role', 'capabilities', 'status', 'expires_at', 'created_at'])
      .where('project_id', '=', access.projectId)
      .where('status', 'in', ['pending', 'accepted'])
      .orderBy('created_at', 'desc')
      .execute(),
  ]);
  const now = Date.now();
  return json(
    ProjectTeamSchema.parse({
      members: members.map((member) =>
        ProjectTeamMemberSchema.parse({
          ...member,
          role: PROJECT_ROLES.includes(member.role as (typeof PROJECT_ROLES)[number])
            ? member.role
            : 'analyst',
          capabilities: member.capabilities.filter(isProjectCapability),
          created_at: member.created_at.toISOString(),
          updated_at: member.updated_at.toISOString(),
        }),
      ),
      invites: invites.map((invite) =>
        ProjectTeamInviteSchema.parse({
          ...invite,
          role: INVITE_ROLES.includes(invite.role as (typeof INVITE_ROLES)[number])
            ? invite.role
            : 'analyst',
          capabilities: invite.capabilities.filter(isProjectCapability),
          status:
            invite.status === 'pending' && invite.expires_at.getTime() <= now
              ? 'expired'
              : invite.status,
          expires_at: invite.expires_at.toISOString(),
          created_at: invite.created_at.toISOString(),
        }),
      ),
    }),
    { headers: { 'cache-control': 'private, no-store' } },
  );
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_team', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectTeamInviteCreateSchema);
  if (body instanceof Response) return body;
  const capabilities = capabilitiesFor(
    body.role,
    body.capabilities,
    access.actor,
    access.projectId,
  );
  if (capabilities instanceof Response) return capabilities;
  const email = body.email.toLowerCase();
  const result = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('project')
      .select('status')
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project) return { kind: 'not-found' as const };
    if (project.status === 'closed') return { kind: 'project-closed' as const };

    const duplicate = await trx
      .selectFrom('project_team_invite')
      .select('id')
      .where('project_id', '=', access.projectId)
      .where('email', '=', email)
      .where('status', '=', 'pending')
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    if (duplicate) return { kind: 'duplicate' as const };

    const row = await trx
      .insertInto('project_team_invite')
      .values({
        id: uuidv7(),
        project_id: access.projectId,
        email,
        role: body.role,
        capabilities,
        invited_by: access.userId,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accepted_at: null,
      })
      .returning(['id', 'email', 'role', 'capabilities', 'status', 'expires_at', 'created_at'])
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.team_invite.created',
            resourceType: 'project_team_invite',
            resourceId: row.id,
            projectId: access.projectId,
            metadata: { role: row.role, capabilities },
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
        payload: { project_id: access.projectId, invite_id: row.id, change: 'team_invite_created' },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'team-invite',
          project_id: access.projectId,
          invite_id: row.id,
        }),
      )
      .execute();
    return { kind: 'created' as const, row };
  });
  if (result.kind === 'not-found') return problem(404, 'Project not found');
  if (result.kind === 'project-closed') {
    return problem(409, 'Project is closed', 'Closed projects do not accept new team members');
  }
  if (result.kind === 'duplicate') return problem(409, 'Invitation already pending');
  const invite = result.row;
  return json(
    ProjectTeamInviteSchema.parse({
      ...invite,
      expires_at: invite.expires_at.toISOString(),
      created_at: invite.created_at.toISOString(),
    }),
    { status: 201, headers: { 'cache-control': 'private, no-store' } },
  );
};
