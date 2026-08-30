import { json, problem } from '$lib/server/http';
import {
  createGuestAccessRepository,
  hashGuestEmail,
  normalizeGuestEmail,
  statusOfGuestAccessToken,
} from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { claimGuestPayment } from '$lib/server/guest-access';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { readJsonValue } from '../../api/api-utils';

type ClaimRequest = { action: 'request-code' | 'claim'; email?: string };

function readClaimRequest(value: unknown): ClaimRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.action !== 'request-code' && body.action !== 'claim') return null;
  if (body.email !== undefined && typeof body.email !== 'string') return null;
  return {
    action: body.action,
    ...(typeof body.email === 'string' ? { email: body.email } : {}),
  };
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Claim unavailable', 'Database is required');
  const value = await readJsonValue(event.request);
  if (value instanceof Response) return value;
  const parsed = readClaimRequest(value);
  if (!parsed) return problem(400, 'Invalid claim request');
  const request = parsed;

  const db = getDb();
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(event.params.token);
  const state = statusOfGuestAccessToken(token);
  if (!token || token.kind !== 'claim') return problem(404, 'Claim link unavailable');
  if (state === 'expired') return problem(410, 'Claim link expired');
  if (state === 'used') return problem(409, 'Claim link already used');
  if (state !== 'valid') return problem(404, 'Claim link unavailable');

  if (request.action === 'request-code') {
    const email = normalizeGuestEmail(request.email ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return problem(400, 'Enter the email used at checkout');
    }
    if (hashGuestEmail(email) !== token.email_hash) {
      await repository.recordFailedAttempt(event.params.token);
      return problem(400, 'Claim details did not match');
    }
    return json({ ok: true });
  }

  const session = event.locals.session;
  if (!session) return problem(401, 'Sign-in required', 'Verify the code before claiming support');
  if (!session.user.emailVerified) {
    return problem(403, 'Verified email required', 'Verify your email before claiming support');
  }
  const result = await claimGuestPayment(
    db,
    event.params.token,
    session.user.id,
    session.user.email,
  );
  if (result.kind === 'claimed') return json({ ok: true, payment_id: result.paymentId });
  if (result.kind === 'pending') return problem(409, 'Payment still processing');
  if (result.kind === 'expired') return problem(410, 'Claim link expired');
  if (result.kind === 'used') return problem(409, 'Claim link already used');
  if (result.kind === 'conflict') return problem(409, 'Support already belongs to another account');
  return problem(400, 'Claim details did not match');
};
