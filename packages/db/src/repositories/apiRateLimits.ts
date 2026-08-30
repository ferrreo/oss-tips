import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type { ApiRateLimit } from '../types.js';

export type ApiRateLimitPolicy = {
  /** Sustained requests allowed during windowSeconds. */
  limit: number;
  windowSeconds: number;
  /** Maximum immediate burst. */
  burst: number;
};

/** Initial limits from docs §5, with explicit ceilings for authenticated sessions. */
export const API_RATE_LIMITS = {
  apiKey: { limit: 600, windowSeconds: 60, burst: 60 },
  apiKeyAnalytics: { limit: 60, windowSeconds: 60, burst: 10 },
  apiKeyExport: { limit: 30, windowSeconds: 60, burst: 5 },
  sessionRead: { limit: 600, windowSeconds: 60, burst: 60 },
  sessionMutation: { limit: 120, windowSeconds: 60, burst: 30 },
  webhookReplay: { limit: 20, windowSeconds: 60, burst: 20 },
} as const satisfies Record<string, ApiRateLimitPolicy>;

export const API_RATE_LIMIT_RETENTION_SECONDS = 24 * 60 * 60;

export type ApiRateLimitState = Pick<ApiRateLimit, 'available_tokens' | 'last_refill_at'>;

export type ApiRateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  burst: number;
  windowSeconds: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

function retryAfter(seconds: number): number {
  return Math.max(1, Math.ceil(seconds));
}

function validatePolicy(policy: ApiRateLimitPolicy): void {
  if (
    !Number.isFinite(policy.limit) ||
    policy.limit <= 0 ||
    !Number.isFinite(policy.windowSeconds) ||
    policy.windowSeconds <= 0 ||
    !Number.isFinite(policy.burst) ||
    policy.burst < 1
  ) {
    throw new Error('Invalid API rate-limit policy');
  }
}

/** Evaluate one token bucket after its row has been locked. */
export function evaluateApiRateLimit(
  input: { state: ApiRateLimitState; now: Date },
  policy: ApiRateLimitPolicy,
): { state: ApiRateLimitState; decision: ApiRateLimitDecision } {
  validatePolicy(policy);
  const refillPerSecond = policy.limit / policy.windowSeconds;
  const elapsedSeconds = Math.max(
    0,
    (input.now.getTime() - input.state.last_refill_at.getTime()) / 1000,
  );
  const available = Math.min(
    policy.burst,
    Math.max(0, input.state.available_tokens) + elapsedSeconds * refillPerSecond,
  );
  const allowed = available >= 1;
  const remainingTokens = allowed ? available - 1 : available;
  const waitSeconds = allowed
    ? (policy.burst - remainingTokens) / refillPerSecond
    : (1 - remainingTokens) / refillPerSecond;
  const retryAfterSeconds = retryAfter(waitSeconds);
  return {
    state: {
      available_tokens: remainingTokens,
      last_refill_at: input.now,
    },
    decision: {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, Math.floor(remainingTokens)),
      burst: policy.burst,
      windowSeconds: policy.windowSeconds,
      resetAt: new Date(input.now.getTime() + retryAfterSeconds * 1000),
      retryAfterSeconds,
    },
  };
}

export type ApiRateLimitsRepository = ReturnType<typeof createApiRateLimitsRepository>;

export function createApiRateLimitsRepository(db: Db) {
  return {
    async consume(input: {
      keyHash: string;
      routeClass: string;
      policy: ApiRateLimitPolicy;
      now?: Date;
    }): Promise<ApiRateLimitDecision> {
      const now = input.now ?? new Date();
      validatePolicy(input.policy);
      return db.transaction().execute(async (trx) => {
        await trx
          .insertInto('api_rate_limit')
          .values({
            id: uuidv7(),
            key_hash: input.keyHash,
            route_class: input.routeClass,
            available_tokens: input.policy.burst,
            last_refill_at: now,
          })
          .onConflict((oc) => oc.columns(['key_hash', 'route_class']).doNothing())
          .execute();

        const row = await trx
          .selectFrom('api_rate_limit')
          .selectAll()
          .where('key_hash', '=', input.keyHash)
          .where('route_class', '=', input.routeClass)
          .forUpdate()
          .executeTakeFirst();
        if (!row) throw new Error('API rate-limit row could not be locked');

        const evaluated = evaluateApiRateLimit({ state: row, now }, input.policy);
        await trx
          .updateTable('api_rate_limit')
          .set({
            available_tokens: evaluated.state.available_tokens,
            last_refill_at: evaluated.state.last_refill_at,
            updated_at: now,
          })
          .where('id', '=', row.id)
          .execute();
        return evaluated.decision;
      });
    },

    /** Remove buckets idle longer than the retention period. Safe to run periodically. */
    async cleanup(input: { now?: Date; retentionSeconds?: number } = {}): Promise<number> {
      const now = input.now ?? new Date();
      const retentionSeconds = input.retentionSeconds ?? API_RATE_LIMIT_RETENTION_SECONDS;
      if (!Number.isFinite(retentionSeconds) || retentionSeconds <= 0) {
        throw new Error('Invalid API rate-limit retention period');
      }
      const cutoff = new Date(now.getTime() - retentionSeconds * 1000);
      const result = await db
        .deleteFrom('api_rate_limit')
        .where('updated_at', '<', cutoff)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
  };
}
