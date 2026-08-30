import { describe, expect, it } from 'vitest';
import type { AuthSession } from './session';
import {
  RECENT_AUTH_MAX_AGE_MS,
  createAuthDevSession,
  hasRecentAuthentication,
  isRecentAuthentication,
  recentAuthenticationRedirectPath,
} from './session';
import type { Db } from '@oss-tips/db';

const now = new Date('2026-08-30T12:00:00.000Z');

function sessionAt(createdAt: Date): AuthSession {
  const session = createAuthDevSession();
  session.session.createdAt = createdAt;
  session.session.updatedAt = createdAt;
  session.session.expiresAt = new Date(now.getTime() + 60 * 60 * 1_000);
  return session;
}

function sessionDb(row: unknown): Pick<Db, 'selectFrom'> {
  return {
    selectFrom: () => ({
      select: () => ({
        where() {
          return this;
        },
        executeTakeFirst: async () => row,
      }),
    }),
  } as unknown as Pick<Db, 'selectFrom'>;
}

describe('recent authentication guard', () => {
  it('accepts a fresh Better Auth session for normal signed-in work', () => {
    expect(
      isRecentAuthentication(sessionAt(new Date(now.getTime() - RECENT_AUTH_MAX_AGE_MS + 1)), now),
    ).toBe(true);
  });

  it('rejects stale or missing session markers', () => {
    expect(
      isRecentAuthentication(sessionAt(new Date(now.getTime() - RECENT_AUTH_MAX_AGE_MS)), now),
    ).toBe(false);
    expect(isRecentAuthentication(null, now)).toBe(false);
    const invalid = sessionAt(now);
    (invalid.session as unknown as { createdAt: unknown }).createdAt = 'invalid';
    expect(isRecentAuthentication(invalid, now)).toBe(false);
  });

  it('requires the durable current session row and expiry', async () => {
    const session = sessionAt(new Date(now.getTime() - 1_000));
    expect(
      await hasRecentAuthentication(
        sessionDb({
          id: session.session.id,
          created_at: session.session.createdAt,
          expires_at: session.session.expiresAt,
        }),
        session,
        now,
      ),
    ).toBe(true);
    expect(await hasRecentAuthentication(sessionDb(undefined), session, now)).toBe(false);
    expect(
      await hasRecentAuthentication(
        sessionDb({
          id: session.session.id,
          created_at: session.session.createdAt,
          expires_at: new Date(now.getTime() - 1),
        }),
        session,
        now,
      ),
    ).toBe(false);
  });

  it('preserves only a safe same-origin return path for reauthentication', () => {
    expect(
      recentAuthenticationRedirectPath({
        url: new URL('https://oss.tips/dashboard/project-1?tab=payments'),
      }),
    ).toBe('/sign-in?returnTo=%2Fdashboard%2Fproject-1%3Ftab%3Dpayments');
  });
});
