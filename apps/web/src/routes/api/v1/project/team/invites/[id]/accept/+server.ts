import { ProjectTeamInviteAcceptSchema } from '@oss-tips/api-contracts';
import { isProjectCapability } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, problem } from '../../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = event.locals.session;
  if (!session) return problem(401, 'Authentication required');
  if (!session.user.emailVerified) {
    return problem(
      403,
      'Verified email required',
      'Verify your email before accepting this invitation',
    );
  }
  const db = getDb();
  const result = await db.transaction().execute(async (trx) => {
    const invite = await trx
      .selectFrom('project_team_invite')
      .selectAll()
      .where('id', '=', event.params.id)
      .forUpdate()
      .executeTakeFirst();
    if (!invite) return { kind: 'missing' as const };
    if (invite.status !== 'pending') return { kind: 'not-pending' as const };
    const now = new Date();
    if (invite.expires_at <= now) {
      await trx
        .updateTable('project_team_invite')
        .set({ status: 'expired', updated_at: now })
        .where('id', '=', invite.id)
        .execute();
      return { kind: 'expired' as const };
    }
    if (invite.email !== session.user.email.toLowerCase()) return { kind: 'mismatch' as const };

    const project = await trx
      .selectFrom('project')
      .select('status')
      .where('id', '=', invite.project_id)
      .forUpdate()
      .executeTakeFirst();
    if (project?.status === 'closed') return { kind: 'project-closed' as const };

    const existing = await trx
      .selectFrom('project_member')
      .select('id')
      .where('project_id', '=', invite.project_id)
      .where('user_id', '=', session.user.id)
      .executeTakeFirst();
    const memberId = existing?.id ?? uuidv7();
    if (!existing) {
      await trx
        .insertInto('project_member')
        .values({
          id: memberId,
          project_id: invite.project_id,
          user_id: session.user.id,
          role: invite.role,
          capabilities: invite.capabilities.filter(isProjectCapability),
        })
        .execute();
    }
    await trx
      .updateTable('project_team_invite')
      .set({ status: 'accepted', accepted_at: now, updated_at: now })
      .where('id', '=', invite.id)
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: session.user.id },
          {
            action: 'project.team_invite.accepted',
            resourceType: 'project_team_invite',
            resourceId: invite.id,
            projectId: invite.project_id,
            metadata: { member_id: memberId },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: invite.project_id,
        event_type: 'project.updated',
        payload: {
          project_id: invite.project_id,
          invite_id: invite.id,
          member_id: memberId,
          change: 'team_invite_accepted',
        },
        published_at: null,
      })
      .execute();
    return { kind: 'accepted' as const, project_id: invite.project_id };
  });

  if (result.kind === 'missing') return problem(404, 'Invitation not found');
  if (result.kind === 'not-pending') return problem(409, 'Invitation is no longer pending');
  if (result.kind === 'expired') return problem(410, 'Invitation expired');
  if (result.kind === 'mismatch') return problem(403, 'Invitation belongs to another email');
  if (result.kind === 'project-closed') {
    return problem(409, 'Project is closed', 'Closed projects do not accept new team members');
  }

  return json(
    ProjectTeamInviteAcceptSchema.parse({ status: 'accepted', project_id: result.project_id }),
    {
      headers: { 'cache-control': 'private, no-store' },
    },
  );
};
