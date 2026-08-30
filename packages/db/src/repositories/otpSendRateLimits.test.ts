import { describe, expect, it } from 'vitest';
import {
  evaluateOtpSend,
  type OtpSendRateLimitPolicy,
  type OtpSendRateLimitState,
} from './otpSendRateLimits.js';

const policy: OtpSendRateLimitPolicy = {
  emailLimit: 5,
  ipLimit: 10,
  windowSeconds: 60 * 60,
  cooldownSeconds: [0, 30, 60, 5 * 60, 15 * 60, 60 * 60],
};

function state(scope: 'email' | 'ip'): OtpSendRateLimitState {
  return {
    scope,
    window_started_at: new Date('2026-08-29T12:00:00.000Z'),
    send_count: 0,
    last_sent_at: null,
    cooldown_level: 0,
  };
}

describe('OTP send rate-limit policy', () => {
  it('allows first send, then enforces escalating email cooldown', () => {
    const first = evaluateOtpSend(
      { email: state('email'), ip: state('ip'), now: new Date('2026-08-29T12:00:00.000Z') },
      policy,
    );
    expect(first.decision.allowed).toBe(true);
    expect(first.email.send_count).toBe(1);

    const blocked = evaluateOtpSend(
      { email: first.email, ip: first.ip, now: new Date('2026-08-29T12:00:01.000Z') },
      policy,
    );
    expect(blocked.decision).toMatchObject({
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: 29,
    });

    const second = evaluateOtpSend(
      { email: first.email, ip: first.ip, now: new Date('2026-08-29T12:00:30.000Z') },
      policy,
    );
    expect(second.decision.allowed).toBe(true);

    const nextBlocked = evaluateOtpSend(
      { email: second.email, ip: second.ip, now: new Date('2026-08-29T12:00:31.000Z') },
      policy,
    );
    expect(nextBlocked.decision).toMatchObject({
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: 59,
    });
  });

  it('enforces five sends per email and ten sends per IP', () => {
    const noCooldown = { ...policy, cooldownSeconds: [0] };
    let email = state('email');
    let ip = state('ip');
    for (let count = 0; count < 5; count += 1) {
      const result = evaluateOtpSend(
        { email, ip, now: new Date(`2026-08-29T12:0${count}:00.000Z`) },
        noCooldown,
      );
      expect(result.decision.allowed).toBe(true);
      email = result.email;
      ip = result.ip;
    }
    const emailBlocked = evaluateOtpSend(
      { email, ip, now: new Date('2026-08-29T12:10:00.000Z') },
      noCooldown,
    );
    expect(emailBlocked.decision).toMatchObject({ allowed: false, reason: 'email' });

    email = state('email');
    ip = state('ip');
    for (let count = 0; count < 10; count += 1) {
      const result = evaluateOtpSend(
        { email, ip, now: new Date(`2026-08-29T12:1${count}:00.000Z`) },
        { ...noCooldown, emailLimit: 20 },
      );
      expect(result.decision.allowed).toBe(true);
      email = result.email;
      ip = result.ip;
    }
    const ipBlocked = evaluateOtpSend(
      { email, ip, now: new Date('2026-08-29T12:20:00.000Z') },
      { ...noCooldown, emailLimit: 20 },
    );
    expect(ipBlocked.decision).toMatchObject({ allowed: false, reason: 'ip' });
  });

  it('starts a fresh window after one hour', () => {
    const first = evaluateOtpSend(
      { email: state('email'), ip: state('ip'), now: new Date('2026-08-29T12:00:00.000Z') },
      { ...policy, cooldownSeconds: [0] },
    );
    const result = evaluateOtpSend(
      {
        email: { ...first.email, send_count: 5 },
        ip: { ...first.ip, send_count: 10 },
        now: new Date('2026-08-29T13:00:00.000Z'),
      },
      { ...policy, cooldownSeconds: [0] },
    );
    expect(result.decision.allowed).toBe(true);
    expect(result.email.send_count).toBe(1);
    expect(result.ip.send_count).toBe(1);
  });
});
