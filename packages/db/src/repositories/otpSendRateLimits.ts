import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type { NewOtpSendRateLimit, OtpSendRateLimit } from '../types.js';

export type OtpSendRateLimitPolicy = {
  emailLimit: number;
  ipLimit: number;
  windowSeconds: number;
  cooldownSeconds: readonly number[];
};

export type OtpSendRateLimitReason = 'cooldown' | 'email' | 'ip';

export type OtpSendRateLimitDecision = {
  allowed: boolean;
  reason: OtpSendRateLimitReason | null;
  emailRemaining: number;
  ipRemaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type OtpSendRateLimitState = Pick<
  OtpSendRateLimit,
  'scope' | 'window_started_at' | 'send_count' | 'last_sent_at' | 'cooldown_level'
>;

export type OtpSendRateLimitEvaluation = {
  email: OtpSendRateLimitState;
  ip: OtpSendRateLimitState;
  decision: OtpSendRateLimitDecision;
};

function retryAfter(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / 1000));
}

function resetExpired(
  row: OtpSendRateLimitState,
  now: Date,
  windowMs: number,
): OtpSendRateLimitState {
  if (row.window_started_at.getTime() + windowMs > now.getTime()) return { ...row };
  return {
    ...row,
    window_started_at: now,
    send_count: 0,
    last_sent_at: null,
    cooldown_level: 0,
  };
}

/** Evaluate one email/IP pair after both rows are locked in one transaction. */
export function evaluateOtpSend(
  input: {
    email: OtpSendRateLimitState;
    ip: OtpSendRateLimitState;
    now: Date;
  },
  policy: OtpSendRateLimitPolicy,
): OtpSendRateLimitEvaluation {
  const nowMs = input.now.getTime();
  const windowMs = policy.windowSeconds * 1000;
  const email = resetExpired(input.email, input.now, windowMs);
  const ip = resetExpired(input.ip, input.now, windowMs);
  const emailWindowEnd = email.window_started_at.getTime() + windowMs;
  const ipWindowEnd = ip.window_started_at.getTime() + windowMs;

  const limitBlocks = [
    email.send_count >= policy.emailLimit
      ? { reason: 'email' as const, resetAt: emailWindowEnd }
      : null,
    ip.send_count >= policy.ipLimit ? { reason: 'ip' as const, resetAt: ipWindowEnd } : null,
  ].filter((value): value is { reason: 'email' | 'ip'; resetAt: number } => value !== null);
  if (limitBlocks.length > 0) {
    const block = limitBlocks.reduce((latest, current) =>
      current.resetAt > latest.resetAt ? current : latest,
    );
    return {
      email,
      ip,
      decision: {
        allowed: false,
        reason: block.reason,
        emailRemaining: Math.max(0, policy.emailLimit - email.send_count),
        ipRemaining: Math.max(0, policy.ipLimit - ip.send_count),
        resetAt: new Date(block.resetAt),
        retryAfterSeconds: retryAfter(block.resetAt, nowMs),
      },
    };
  }

  const cooldownSeconds =
    policy.cooldownSeconds[Math.min(email.cooldown_level, policy.cooldownSeconds.length - 1)] ?? 0;
  const cooldownEnd = (email.last_sent_at?.getTime() ?? 0) + cooldownSeconds * 1000;
  if (email.last_sent_at && cooldownEnd > nowMs) {
    return {
      email,
      ip,
      decision: {
        allowed: false,
        reason: 'cooldown',
        emailRemaining: Math.max(0, policy.emailLimit - email.send_count),
        ipRemaining: Math.max(0, policy.ipLimit - ip.send_count),
        resetAt: new Date(cooldownEnd),
        retryAfterSeconds: retryAfter(cooldownEnd, nowMs),
      },
    };
  }

  const nextCooldownLevel = Math.min(
    email.cooldown_level + 1,
    Math.max(0, policy.cooldownSeconds.length - 1),
  );
  const updatedEmail: OtpSendRateLimitState = {
    ...email,
    send_count: email.send_count + 1,
    last_sent_at: input.now,
    cooldown_level: nextCooldownLevel,
  };
  const updatedIp: OtpSendRateLimitState = {
    ...ip,
    send_count: ip.send_count + 1,
  };
  const resetAt = new Date(Math.max(emailWindowEnd, ipWindowEnd));
  return {
    email: updatedEmail,
    ip: updatedIp,
    decision: {
      allowed: true,
      reason: null,
      emailRemaining: Math.max(0, policy.emailLimit - updatedEmail.send_count),
      ipRemaining: Math.max(0, policy.ipLimit - updatedIp.send_count),
      resetAt,
      retryAfterSeconds: retryAfter(resetAt.getTime(), nowMs),
    },
  };
}

export type OtpSendRateLimitsRepository = ReturnType<typeof createOtpSendRateLimitsRepository>;

export function createOtpSendRateLimitsRepository(db: Db) {
  return {
    async consume(input: {
      emailKey: string;
      ipKey: string;
      now?: Date;
      policy: OtpSendRateLimitPolicy;
    }): Promise<OtpSendRateLimitDecision> {
      const now = input.now ?? new Date();
      return db.transaction().execute(async (trx) => {
        const initialRows: NewOtpSendRateLimit[] = [
          {
            id: uuidv7(),
            scope: 'email',
            key_hash: input.emailKey,
            window_started_at: now,
            send_count: 0,
            last_sent_at: null,
            cooldown_level: 0,
          },
          {
            id: uuidv7(),
            scope: 'ip',
            key_hash: input.ipKey,
            window_started_at: now,
            send_count: 0,
            last_sent_at: null,
            cooldown_level: 0,
          },
        ];
        await trx
          .insertInto('otp_send_rate_limit')
          .values(initialRows)
          .onConflict((oc) => oc.columns(['scope', 'key_hash']).doNothing())
          .execute();

        const rows = await trx
          .selectFrom('otp_send_rate_limit')
          .selectAll()
          .where('scope', 'in', ['email', 'ip'])
          .where('key_hash', 'in', [input.emailKey, input.ipKey])
          .forUpdate()
          .execute();
        const email = rows.find((row) => row.scope === 'email');
        const ip = rows.find((row) => row.scope === 'ip');
        if (!email || !ip) throw new Error('OTP rate-limit rows could not be locked');

        const evaluated = evaluateOtpSend({ email, ip, now }, input.policy);
        for (const row of [evaluated.email, evaluated.ip]) {
          await trx
            .updateTable('otp_send_rate_limit')
            .set({
              window_started_at: row.window_started_at,
              send_count: row.send_count,
              last_sent_at: row.last_sent_at,
              cooldown_level: row.cooldown_level,
              updated_at: now,
            })
            .where('scope', '=', row.scope)
            .where('key_hash', '=', row.scope === 'email' ? input.emailKey : input.ipKey)
            .execute();
        }
        return evaluated.decision;
      });
    },
  };
}
