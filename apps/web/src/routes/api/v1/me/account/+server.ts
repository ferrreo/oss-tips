import { SESSION_COOKIE_NAME } from '@oss-tips/auth';
import type { RequestHandler } from './$types';
import { auditRecord, problem, requireSession } from '../../../api-utils';
import { accountDeletionBlocker } from '$lib/server/account-deletion';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const db = getDb();
  const userId = session.userId;
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const deletion = await db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('user')
        .select('id')
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user) return { deleted: false, blocker: null };

      const blockers = await Promise.all([
        trx
          .selectFrom('subscription')
          .select('id')
          .where('user_id', '=', userId)
          .where('status', 'in', ['active', 'past_due', 'grace'])
          .limit(1)
          .executeTakeFirst(),
        trx
          .selectFrom('project_member')
          .select('id')
          .where('user_id', '=', userId)
          .where('role', '=', 'owner')
          .limit(1)
          .executeTakeFirst(),
        trx
          .selectFrom('post')
          .select('id')
          .where('author_id', '=', userId)
          .limit(1)
          .executeTakeFirst(),
        trx
          .selectFrom('post_revision')
          .select('id')
          .where('created_by', '=', userId)
          .limit(1)
          .executeTakeFirst(),
        trx
          .selectFrom('platform_member')
          .select('id')
          .where('user_id', '=', userId)
          .limit(1)
          .executeTakeFirst(),
      ]);
      const [activeMembership, ownedProject, authoredPost, authoredRevision, platformRole] =
        blockers;
      const blocker = accountDeletionBlocker({
        activeMembership: Boolean(activeMembership),
        ownedProject: Boolean(ownedProject),
        authoredContent: Boolean(authoredPost || authoredRevision),
        platformRole: Boolean(platformRole),
      });
      if (blocker) return { deleted: false, blocker };

      await trx
        .updateTable('payment')
        .set({
          receipt_email: null,
          public_show_name: false,
          public_show_amount: false,
          public_show_message: false,
          public_display_name: null,
          public_message: null,
          updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();
      await trx.deleteFrom('supporter_public_profile').where('user_id', '=', userId).execute();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId },
            { action: 'account.deleted', resourceType: 'user', resourceId: userId },
          ),
        )
        .execute();
      const result = await trx.deleteFrom('user').where('id', '=', userId).executeTakeFirst();
      return { deleted: Number(result.numDeletedRows) > 0, blocker: null };
    });
    if (deletion.blocker) return problem(409, 'Account cannot be deleted', deletion.blocker);
    if (!deletion.deleted) return problem(404, 'User not found');
  } catch (error) {
    console.error('[account] Failed to delete supporter account', error);
    return problem(500, 'Account could not be deleted');
  }

  event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  event.cookies.delete('better-auth.session_token', { path: '/' });
  event.cookies.delete('__Secure-better-auth.session_token', { path: '/' });
  return new Response(null, { status: 204 });
};
