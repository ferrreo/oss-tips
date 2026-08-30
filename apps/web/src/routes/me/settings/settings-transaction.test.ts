import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/auth', () => ({
  createAuthForDatabase: vi.fn(),
  getAuth: vi.fn(),
  getConfiguredOAuthProviders: vi.fn(() => []),
}));

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(() => true),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fme%2Fsettings'),
  requireAuthenticated: vi.fn((event: { locals: { session: unknown } }) => event.locals.session),
}));

import { createAuthForDatabase, getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { actions } from './+page.server';

type SecurityState = {
  name: string;
  passkeys: Set<string>;
  sessions: Array<{ id: string; userId: string; token: string }>;
  accounts: Set<string>;
  events: unknown[];
  jobs: unknown[];
};

const session = {
  session: {
    id: 'current-session',
    userId: 'user-1',
    token: 'current-token',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-1',
    name: 'Before',
    email: 'user@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

function cloneState(state: SecurityState): SecurityState {
  return {
    ...state,
    passkeys: new Set(state.passkeys),
    sessions: state.sessions.map((item) => ({ ...item })),
    accounts: new Set(state.accounts),
    events: [...state.events],
    jobs: [...state.jobs],
  };
}

function fakeDb(state: SecurityState, failJob: boolean) {
  const trx = {
    insertInto(table: string) {
      return {
        values(value: unknown) {
          return {
            execute: async () => {
              if (table === 'job' && failJob) throw new Error('job insert failed');
              if (table === 'user_security_event') state.events.push(value);
              if (table === 'job') state.jobs.push(value);
            },
          };
        },
      };
    },
  };
  return {
    transactionCount: 0,
    transaction() {
      this.transactionCount += 1;
      return {
        execute: async <T>(callback: (transaction: typeof trx) => Promise<T>) => {
          const snapshot = cloneState(state);
          try {
            return await callback(trx);
          } catch (error) {
            Object.assign(state, cloneState(snapshot));
            throw error;
          }
        },
      };
    },
  };
}

function fakeAuth(state: SecurityState) {
  return {
    api: {
      updateUser: async ({ body }: { body: { name: string } }) => {
        state.name = body.name;
        return { status: true };
      },
      listSessions: async () => state.sessions,
      revokeSession: async ({ body }: { body: { token: string } }) => {
        state.sessions = state.sessions.filter((item) => item.token !== body.token);
        return { status: true };
      },
      revokeOtherSessions: async () => {
        state.sessions = state.sessions.filter((item) => item.token === 'current-token');
        return { status: true };
      },
      unlinkAccount: async ({ body }: { body: { accountId: string } }) => {
        state.accounts.delete(body.accountId);
        return { status: true };
      },
      deletePasskey: async ({ body }: { body: { id: string } }) => {
        state.passkeys.delete(body.id);
        return { status: true };
      },
    },
  };
}

function event(path: string, fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    request: new Request(`https://oss.tips/me/settings?action=${path}`, {
      method: 'POST',
      body: form,
    }),
    url: new URL(`https://oss.tips/me/settings?action=${path}`),
    locals: { session },
  } as never;
}

function stateFor(action: string): SecurityState {
  return {
    name: 'Before',
    passkeys: new Set(action === 'removePasskey' ? ['passkey-1'] : []),
    sessions: [
      { id: 'current-session', userId: 'user-1', token: 'current-token' },
      { id: 'session-1', userId: 'user-1', token: 'session-token-1' },
    ],
    accounts: new Set(action === 'unlinkAccount' ? ['account-1', 'account-2'] : []),
    events: [],
    jobs: [],
  };
}

const actionsToTest = [
  ['saveProfile', { displayName: 'After' }],
  ['removePasskey', { id: 'passkey-1' }],
  ['revokeSession', { id: 'session-1' }],
  ['revokeOtherSessions', {}],
  ['unlinkAccount', { id: 'account-1' }],
] as const;

const securityActions = {
  saveProfile: 'profile_updated',
  removePasskey: 'passkey_removed',
  revokeSession: 'session_revoked',
  revokeOtherSessions: 'sessions_revoked',
  unlinkAccount: 'account_unlinked',
} as const;

describe('account security mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);
  });

  it.each(actionsToTest)(
    '%s commits its mutation and notification together',
    async (name, fields) => {
      const state = stateFor(name);
      const db = fakeDb(state, false);
      vi.mocked(getDb).mockReturnValue(db as never);
      vi.mocked(createAuthForDatabase).mockImplementation(() => fakeAuth(state) as never);

      const result = await actions[name](event(name, fields));

      expect(result).toMatchObject({ ok: true });
      expect(state.events).toHaveLength(1);
      expect(state.jobs).toHaveLength(1);
      expect(db.transactionCount).toBe(1);
      expect(state.events[0]).toMatchObject({
        event_type: 'account.security_changed',
        user_id: 'user-1',
        metadata: { action: securityActions[name] },
      });
      expect(state.jobs[0]).toMatchObject({
        payload: {
          notification: 'security-change',
          user_id: 'user-1',
          action: securityActions[name],
        },
      });
      expect(vi.mocked(createAuthForDatabase)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createAuthForDatabase).mock.calls[0]?.[0]).toBeDefined();
      expect(getAuth).not.toHaveBeenCalled();
    },
  );

  it.each(actionsToTest)(
    '%s rolls back its mutation when notification enqueue fails',
    async (name, fields) => {
      const state = stateFor(name);
      const before = cloneState(state);
      vi.mocked(getDb).mockReturnValue(fakeDb(state, true) as never);
      vi.mocked(createAuthForDatabase).mockImplementation(() => fakeAuth(state) as never);

      const result = await actions[name](event(name, fields));

      expect(result).toHaveProperty('status');
      expect(state.name).toBe(before.name);
      expect([...state.passkeys]).toEqual([...before.passkeys]);
      expect(state.sessions).toEqual(before.sessions);
      expect([...state.accounts]).toEqual([...before.accounts]);
      expect(state.events).toHaveLength(0);
      expect(state.jobs).toHaveLength(0);
    },
  );

  it('does not enqueue a notice when Better Auth rejects the mutation', async () => {
    const state = stateFor('saveProfile');
    vi.mocked(getDb).mockReturnValue(fakeDb(state, false) as never);
    vi.mocked(createAuthForDatabase).mockImplementation(
      () =>
        ({
          api: {
            updateUser: vi.fn(async () => {
              throw new Error('auth mutation failed');
            }),
          },
        }) as never,
    );

    const result = await actions.saveProfile(event('saveProfile', { displayName: 'After' }));

    expect(result).toHaveProperty('status');
    expect(state.name).toBe('Before');
    expect(state.events).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });

  it.each(actionsToTest.filter(([name]) => name !== 'saveProfile'))(
    '%s redirects before mutation when authentication is stale',
    async (name, fields) => {
      const state = stateFor(name);
      const before = cloneState(state);
      const db = fakeDb(state, false);
      vi.mocked(getDb).mockReturnValue(db as never);
      vi.mocked(hasRecentAuthentication).mockResolvedValue(false);

      await expect(actions[name](event(name, fields))).rejects.toMatchObject({ status: 303 });

      expect(db.transactionCount).toBe(0);
      expect(state).toEqual(before);
      expect(createAuthForDatabase).not.toHaveBeenCalled();
    },
  );
});
