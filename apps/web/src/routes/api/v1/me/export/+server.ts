import type { RequestHandler } from './$types';
import { problem, requireSession } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function money(value: string | bigint | number | null): string | null {
  return value == null ? null : String(value);
}

export const GET: RequestHandler = async (event) => {
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
    const user = await db
      .selectFrom('user')
      .select([
        'id',
        'name',
        'email',
        'email_verified',
        'image',
        'theme_preference',
        'locale',
        'created_at',
        'updated_at',
      ])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) return problem(404, 'User not found');

    const [sessions, passkeys, accounts, memberships, entitlements, payments, profiles, threads] =
      await Promise.all([
        db
          .selectFrom('session')
          .select(['id', 'created_at', 'updated_at', 'expires_at', 'ip_address', 'user_agent'])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('passkey')
          .select(['id', 'name', 'device_type', 'backed_up', 'created_at', 'last_used_at'])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('account')
          .select([
            'id',
            'account_id',
            'provider_id',
            'issuer',
            'scope',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('subscription')
          .select([
            'id',
            'project_id',
            'tier_id',
            'status',
            'current_period_end',
            'grace_ends_at',
            'cancel_at_period_end',
            'project_amount_minor',
            'platform_tip_minor',
            'currency',
            'feature_mode',
            'cadence',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('entitlement')
          .select([
            'id',
            'project_id',
            'tier_id',
            'payment_id',
            'subscription_id',
            'kind',
            'tier_rank',
            'starts_at',
            'ends_at',
            'revoked_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('payment')
          .select([
            'id',
            'project_id',
            'currency',
            'exponent',
            'customer_charge_minor',
            'project_amount_minor',
            'platform_tip_minor',
            'oss_project_fee_minor',
            'stripe_application_fee_minor',
            'status',
            'cadence',
            'feature_mode',
            'receipt_email',
            'public_show_name',
            'public_show_amount',
            'public_show_message',
            'settled_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('supporter_public_profile')
          .select([
            'project_id',
            'display_name',
            'show_amount',
            'show_name',
            'show_message',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
        db
          .selectFrom('supporter_message_thread')
          .select(['id', 'project_id', 'payment_id', 'status', 'created_at', 'updated_at'])
          .where('supporter_user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute(),
      ]);

    const threadIds = threads.map((thread) => thread.id);
    const messages = threadIds.length
      ? await db
          .selectFrom('supporter_message')
          .select(['id', 'thread_id', 'author_user_id', 'author_name', 'body', 'created_at'])
          .where('thread_id', 'in', threadIds)
          .where('is_internal', '=', false)
          .orderBy('created_at', 'asc')
          .execute()
      : [];

    return json(
      {
        exported_at: new Date().toISOString(),
        account: {
          id: user.id,
          name: user.name,
          email: user.email,
          email_verified: user.email_verified,
          image: user.image,
          theme_preference: user.theme_preference,
          locale: user.locale,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
        sessions: sessions.map((row) => ({
          id: row.id,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
          expires_at: row.expires_at.toISOString(),
          ip_address: row.ip_address,
          user_agent: row.user_agent,
        })),
        passkeys: passkeys.map((row) => ({
          id: row.id,
          name: row.name,
          device_type: row.device_type,
          backed_up: row.backed_up,
          created_at: row.created_at.toISOString(),
          last_used_at: iso(row.last_used_at),
        })),
        linked_accounts: accounts.map((row) => ({
          id: row.id,
          account_id: row.account_id,
          provider_id: row.provider_id,
          issuer: row.issuer,
          scope: row.scope,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        memberships: memberships.map((row) => ({
          id: row.id,
          project_id: row.project_id,
          tier_id: row.tier_id,
          status: row.status,
          current_period_end: iso(row.current_period_end),
          grace_ends_at: iso(row.grace_ends_at),
          cancel_at_period_end: row.cancel_at_period_end,
          project_amount_minor: money(row.project_amount_minor),
          platform_tip_minor: money(row.platform_tip_minor),
          currency: row.currency,
          feature_mode: row.feature_mode,
          cadence: row.cadence,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        entitlements: entitlements.map((row) => ({
          id: row.id,
          project_id: row.project_id,
          tier_id: row.tier_id,
          payment_id: row.payment_id,
          subscription_id: row.subscription_id,
          kind: row.kind,
          tier_rank: row.tier_rank,
          starts_at: row.starts_at.toISOString(),
          ends_at: iso(row.ends_at),
          revoked_at: iso(row.revoked_at),
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        payments: payments.map((row) => ({
          id: row.id,
          project_id: row.project_id,
          currency: row.currency,
          exponent: row.exponent,
          customer_charge_minor: money(row.customer_charge_minor),
          project_amount_minor: money(row.project_amount_minor),
          platform_tip_minor: money(row.platform_tip_minor),
          oss_project_fee_minor: money(row.oss_project_fee_minor),
          stripe_application_fee_minor: money(row.stripe_application_fee_minor),
          status: row.status,
          cadence: row.cadence,
          feature_mode: row.feature_mode,
          receipt_email: row.receipt_email,
          public_show_name: row.public_show_name,
          public_show_amount: row.public_show_amount,
          public_show_message: row.public_show_message,
          settled_at: iso(row.settled_at),
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        public_wall_preferences: profiles.map((row) => ({
          project_id: row.project_id,
          display_name: row.display_name,
          show_amount: row.show_amount,
          show_name: row.show_name,
          show_message: row.show_message,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        message_threads: threads.map((row) => ({
          id: row.id,
          project_id: row.project_id,
          payment_id: row.payment_id,
          status: row.status,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        })),
        messages: messages.map((row) => ({
          id: row.id,
          thread_id: row.thread_id,
          author_user_id: row.author_user_id,
          author_name: row.author_name,
          body: row.body,
          created_at: row.created_at.toISOString(),
        })),
      },
      {
        headers: {
          'cache-control': 'no-store',
          'content-disposition': 'attachment; filename="oss-tips-data.json"',
        },
      },
    );
  } catch (error) {
    console.error('[account] Failed to prepare supporter data export', error);
    return problem(500, 'Data export is unavailable');
  }
};
