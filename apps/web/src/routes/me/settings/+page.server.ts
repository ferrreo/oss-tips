import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { emailNotificationJob, type Db } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import { createAuthForDatabase, getAuth, getConfiguredOAuthProviders } from '$lib/server/auth';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  ownedSessionToken,
  type PasskeyRecord,
  sanitizeAccount,
  sanitizePasskey,
  sanitizeSession,
} from '$lib/server/account-security';
import {
  hasRecentAuthentication,
  recentAuthenticationRedirectPath,
  requireAuthenticated,
  type AuthSession,
} from '$lib/server/session';

const providerLabels = {
  github: 'GitHub',
  google: 'Google',
  discord: 'Discord',
  gitlab: 'GitLab',
  codeberg: 'Codeberg',
} as const;

function providerOptions() {
  return getConfiguredOAuthProviders().map((id) => ({ id, label: providerLabels[id] }));
}

function formString(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function actionFailure(status: number, message: string) {
  return fail(status, { error: message });
}

async function requireRecentSecurityAuthentication(
  event: Pick<RequestEvent, 'locals' | 'url'>,
  session: AuthSession,
): Promise<void> {
  if (await hasRecentAuthentication(getDb(), session)) return;
  throw redirect(303, recentAuthenticationRedirectPath(event));
}

type SecurityAction =
  | 'profile_updated'
  | 'passkey_removed'
  | 'session_revoked'
  | 'sessions_revoked'
  | 'account_unlinked';

type SecurityDb = Pick<Db, 'insertInto'>;

async function enqueueSecurityChange(
  db: SecurityDb,
  userId: string,
  action: SecurityAction,
): Promise<void> {
  const eventId = uuidv7();
  await db
    .insertInto('user_security_event')
    .values({
      id: eventId,
      user_id: userId,
      event_type: 'account.security_changed',
      ip_address: null,
      user_agent: null,
      metadata: { action },
    })
    .execute();
  await db
    .insertInto('job')
    .values(
      emailNotificationJob({
        notification: 'security-change',
        user_id: userId,
        event_id: eventId,
        action,
      }),
    )
    .execute();
}

async function withSecurityChange<T>(
  userId: string,
  action: SecurityAction,
  operation: (auth: ReturnType<typeof getAuth>) => Promise<T>,
): Promise<T> {
  // Bind Better Auth to this transaction so mutation and notification commit together.
  return getDb()
    .transaction()
    .execute(async (trx) => {
      const result = await operation(createAuthForDatabase(trx));
      await enqueueSecurityChange(trx, userId, action);
      return result;
    });
}

type PasskeyApi = {
  listPasskeys(input: { headers: Headers }): Promise<PasskeyRecord[]>;
  deletePasskey(input: { headers: Headers; body: { id: string } }): Promise<{ status: boolean }>;
};

function passkeyApi(auth: ReturnType<typeof getAuth>): PasskeyApi {
  return auth.api as typeof auth.api & PasskeyApi;
}

export const load: PageServerLoad = async (event) => {
  const session = requireAuthenticated(event);
  const providers = providerOptions();
  if (!hasDatabaseUrl()) {
    return {
      oauthProviders: providers,
      passkeys: [],
      sessions: [],
      linkedAccounts: [],
      securityState: 'ready' as const,
    };
  }

  try {
    const auth = getAuth();
    const passkeysApi = passkeyApi(auth);
    const [sessions, passkeys, accounts, passkeyUsage] = await Promise.all([
      auth.api.listSessions({ headers: event.request.headers }),
      passkeysApi.listPasskeys({ headers: event.request.headers }),
      auth.api.listUserAccounts({ headers: event.request.headers }),
      getDb()
        .selectFrom('passkey')
        .select(['id', 'last_used_at'])
        .where('user_id', '=', session.user.id)
        .execute(),
    ]);
    const lastUsedById = new Map(passkeyUsage.map((item) => [item.id, item.last_used_at]));
    return {
      oauthProviders: providers,
      sessions: sessions.map((item) => sanitizeSession(item, session.session.id)),
      passkeys: passkeys.map((item) =>
        sanitizePasskey({ ...item, lastUsedAt: lastUsedById.get(item.id) }),
      ),
      linkedAccounts: accounts
        .filter((account) => providers.some((provider) => provider.id === account.providerId))
        .map(sanitizeAccount),
      securityState: 'ready' as const,
    };
  } catch (error) {
    console.error('[auth] Failed to load account security settings', error);
    return {
      oauthProviders: providers,
      passkeys: [],
      sessions: [],
      linkedAccounts: [],
      securityState: 'error' as const,
      securityError: 'Security settings are temporarily unavailable. Try again shortly.',
    };
  }
};

export const actions: Actions = {
  saveProfile: async (event) => {
    const session = requireAuthenticated(event);
    if (!hasDatabaseUrl())
      return actionFailure(503, 'Account updates require a database connection.');
    const form = await event.request.formData();
    const displayName = formString(form, 'displayName');
    const email = formString(form, 'email');
    if (!displayName) return actionFailure(400, 'Display name is required.');
    if (email && email.toLowerCase() !== session.user.email.toLowerCase()) {
      return actionFailure(400, 'Email changes require a separate verification flow.');
    }
    try {
      await withSecurityChange(session.user.id, 'profile_updated', (auth) =>
        auth.api.updateUser({
          headers: event.request.headers,
          body: { name: displayName },
        }),
      );
      return { ok: true };
    } catch {
      return actionFailure(400, 'Your profile could not be updated.');
    }
  },

  removePasskey: async (event) => {
    const session = requireAuthenticated(event);
    if (!hasDatabaseUrl())
      return actionFailure(503, 'Passkey management requires a database connection.');
    await requireRecentSecurityAuthentication(event, session);
    const id = formString(await event.request.formData(), 'id');
    if (!id) return actionFailure(400, 'Passkey id is required.');
    try {
      await withSecurityChange(session.user.id, 'passkey_removed', (auth) =>
        passkeyApi(auth).deletePasskey({
          headers: event.request.headers,
          body: { id },
        }),
      );
      return { ok: true };
    } catch {
      return actionFailure(404, 'Passkey not found or already removed.');
    }
  },

  revokeSession: async (event) => {
    const session = requireAuthenticated(event);
    if (!hasDatabaseUrl())
      return actionFailure(503, 'Session management requires a database connection.');
    await requireRecentSecurityAuthentication(event, session);
    const id = formString(await event.request.formData(), 'id');
    if (!id) return actionFailure(400, 'Session id is required.');
    try {
      await withSecurityChange(session.user.id, 'session_revoked', async (auth) => {
        const sessions = await auth.api.listSessions({ headers: event.request.headers });
        const token = ownedSessionToken(sessions, session.user.id, id);
        if (!token) throw new Error('Session not found.');
        await auth.api.revokeSession({ headers: event.request.headers, body: { token } });
      });
      return { ok: true, revokedSessionId: id };
    } catch {
      return actionFailure(404, 'Session not found or already revoked.');
    }
  },

  revokeOtherSessions: async (event) => {
    const session = requireAuthenticated(event);
    if (!hasDatabaseUrl())
      return actionFailure(503, 'Session management requires a database connection.');
    await requireRecentSecurityAuthentication(event, session);
    try {
      await withSecurityChange(session.user.id, 'sessions_revoked', (auth) =>
        auth.api.revokeOtherSessions({ headers: event.request.headers }),
      );
      return { ok: true };
    } catch {
      return actionFailure(400, 'Other sessions could not be revoked.');
    }
  },

  unlinkAccount: async (event) => {
    const session = requireAuthenticated(event);
    if (!hasDatabaseUrl())
      return actionFailure(503, 'Account management requires a database connection.');
    await requireRecentSecurityAuthentication(event, session);
    const id = formString(await event.request.formData(), 'id');
    if (!id) return actionFailure(400, 'Account id is required.');
    try {
      await withSecurityChange(session.user.id, 'account_unlinked', (auth) =>
        auth.api.unlinkAccount({
          headers: event.request.headers,
          body: { accountId: id },
        }),
      );
      return { ok: true, unlinkedAccountId: id };
    } catch {
      return actionFailure(
        400,
        'Account could not be unlinked. Keep one sign-in method connected.',
      );
    }
  },
};
