import type { PageServerLoad } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';

type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

function inviteStatus(value: string): InviteStatus | null {
  return value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired'
    ? value
    : null;
}

function sessionData(email: string | undefined) {
  return email ? { email } : null;
}

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const inviteId = params.id;
  if (!hasDatabaseUrl()) {
    return { inviteId, invite: null, session: null, state: 'error' as const };
  }

  try {
    const row = await getDb()
      .selectFrom('project_team_invite')
      .innerJoin('project', 'project.id', 'project_team_invite.project_id')
      .select([
        'project_team_invite.id as invite_id',
        'project_team_invite.email as invite_email',
        'project_team_invite.role as invite_role',
        'project_team_invite.status as invite_status',
        'project_team_invite.expires_at as invite_expires_at',
        'project.name as project_name',
        'project.slug as project_slug',
      ])
      .where('project_team_invite.id', '=', inviteId)
      .executeTakeFirst();

    if (!row) return { inviteId, invite: null, session: null, state: 'missing' as const };
    const status = inviteStatus(row.invite_status);
    if (!status) return { inviteId, invite: null, session: null, state: 'error' as const };

    const invite = {
      id: row.invite_id,
      project: { name: row.project_name, slug: row.project_slug },
      role: row.invite_role,
      status,
      expiresAt: row.invite_expires_at.toISOString(),
    };
    const session = sessionData(locals.session?.user.email);
    let state: 'ready' | 'signed-out' | 'mismatch' | 'expired' | 'accepted' | 'used';
    if (status === 'accepted') state = 'accepted';
    else if (status === 'revoked') state = 'used';
    else if (status === 'expired' || row.invite_expires_at <= new Date()) state = 'expired';
    else if (!session) state = 'signed-out';
    else if (row.invite_email.trim().toLowerCase() !== session.email.trim().toLowerCase())
      state = 'mismatch';
    else state = 'ready';

    return { inviteId, invite, session, state };
  } catch (cause) {
    console.error('[team-invite] Failed to load invitation', cause);
    return { inviteId, invite: null, session: null, state: 'error' as const };
  }
};
