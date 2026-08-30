import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type { GuestAccessToken, GuestAccessTokenTable, NewGuestAccessToken } from '../types.js';

export const GUEST_ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_ACCESS_MAX_ATTEMPTS = 5;

export type GuestAccessTokenKind = GuestAccessTokenTable['kind'];
export type GuestAccessTokenStatus = 'valid' | 'expired' | 'used' | 'locked' | 'missing';

export function normalizeGuestEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashGuestEmail(email: string): string {
  return createHash('sha256').update(normalizeGuestEmail(email), 'utf8').digest('hex');
}

export function hashGuestAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isGuestAccessTokenFormat(token: string): boolean {
  return /^gat_[A-Za-z0-9_-]{43}$/.test(token);
}

export function statusOfGuestAccessToken(
  token: GuestAccessToken | undefined,
  now = new Date(),
): GuestAccessTokenStatus {
  if (!token) return 'missing';
  if (token.used_at) return 'used';
  if (token.expires_at <= now) return 'expired';
  if (token.attempt_count >= GUEST_ACCESS_MAX_ATTEMPTS) return 'locked';
  return 'valid';
}

export type IssueGuestAccessTokenInput = {
  kind: GuestAccessTokenKind;
  paymentId?: string;
  threadId?: string;
  email: string;
  expiresAt?: Date;
  now?: Date;
};

export type GuestAccessTokenRepository = ReturnType<typeof createGuestAccessRepository>;

export function createGuestAccessRepository(db: Db) {
  return {
    async issue(input: IssueGuestAccessTokenInput): Promise<{
      token: string;
      record: GuestAccessToken;
    }> {
      if (input.kind === 'claim' && !input.paymentId) {
        throw new Error('Claim token requires a payment');
      }
      if (input.kind === 'claim' && input.threadId) {
        throw new Error('Claim token cannot target a thread');
      }
      if (input.kind === 'reply' && !input.threadId) {
        throw new Error('Reply token requires a thread');
      }
      if (input.kind === 'reply' && input.paymentId) {
        throw new Error('Reply token cannot target a payment');
      }
      const email = normalizeGuestEmail(input.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Guest access email is invalid');
      }

      const token = `gat_${randomBytes(32).toString('base64url')}`;
      const now = input.now ?? new Date();
      const expiresAt = input.expiresAt ?? new Date(now.getTime() + GUEST_ACCESS_TOKEN_TTL_MS);
      if (expiresAt <= now) {
        throw new Error('Guest access token expiry must be in the future');
      }
      if (expiresAt.getTime() > now.getTime() + GUEST_ACCESS_TOKEN_TTL_MS) {
        throw new Error('Guest access token expiry exceeds maximum lifetime');
      }
      const row: NewGuestAccessToken = {
        id: uuidv7(),
        kind: input.kind,
        token_hash: hashGuestAccessToken(token),
        payment_id: input.paymentId ?? null,
        thread_id: input.threadId ?? null,
        email_hash: hashGuestEmail(email),
        attempt_count: 0,
        expires_at: expiresAt,
        used_at: null,
      };
      const record = await db
        .insertInto('guest_access_token')
        .values(row)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { token, record };
    },

    async find(token: string): Promise<GuestAccessToken | undefined> {
      if (!isGuestAccessTokenFormat(token)) return undefined;
      return db
        .selectFrom('guest_access_token')
        .selectAll()
        .where('token_hash', '=', hashGuestAccessToken(token))
        .executeTakeFirst();
    },

    async recordFailedAttempt(token: string, now = new Date()): Promise<boolean> {
      if (!isGuestAccessTokenFormat(token)) return false;
      const updated = await db
        .updateTable('guest_access_token')
        .set({ attempt_count: sql<number>`attempt_count + 1` })
        .where('token_hash', '=', hashGuestAccessToken(token))
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .where('attempt_count', '<', GUEST_ACCESS_MAX_ATTEMPTS)
        .returning('id')
        .executeTakeFirst();
      return Boolean(updated);
    },

    /** Atomically marks a valid token used. A second request cannot consume it. */
    async consume(token: string, now = new Date()): Promise<GuestAccessToken | undefined> {
      if (!isGuestAccessTokenFormat(token)) return undefined;
      return db
        .updateTable('guest_access_token')
        .set({ used_at: now })
        .where('token_hash', '=', hashGuestAccessToken(token))
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .returningAll()
        .executeTakeFirst();
    },
  };
}
