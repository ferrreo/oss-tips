import { MembershipPatchSchema, MembershipSchema } from '@oss-tips/api-contracts';
import { createStripeClient, minorUnits, validateIdempotencyKey } from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { auditRecord, problem, readJson, requireSession } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

function membershipPayload(row: {
  id: string;
  project_id: string;
  tier_id: string;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  platform_tip_minor: string | number | bigint | null;
  currency: string | null;
}) {
  return MembershipSchema.parse({
    id: row.id,
    project_id: row.project_id,
    tier_id: row.tier_id,
    status: ['active', 'grace', 'cancelled', 'expired', 'incomplete'].includes(row.status)
      ? row.status
      : 'incomplete',
    current_period_end: row.current_period_end?.toISOString() ?? null,
    cancel_at_period_end: row.cancel_at_period_end,
    platform_tip:
      row.platform_tip_minor === null || row.currency === null
        ? null
        : { amount: String(row.platform_tip_minor), currency: row.currency.toLowerCase() },
  });
}

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const db = getDb();
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }
  const body = await readJson(event.request, MembershipPatchSchema);
  if (body instanceof Response) return body;
  const requestedTip = body.platform_tip;
  let idempotencyKey: string | undefined;
  if (requestedTip) {
    const rawIdempotencyKey = event.request.headers.get('idempotency-key')?.trim();
    if (!rawIdempotencyKey) {
      return problem(
        400,
        'Idempotency key required',
        'Tip changes must include a valid Idempotency-Key',
      );
    }
    try {
      idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
    } catch {
      return problem(400, 'Invalid idempotency key');
    }
  }

  let stripe: ReturnType<typeof createStripeClient> | undefined;
  if (requestedTip) {
    try {
      stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
    } catch {
      return problem(503, 'Membership tip unavailable', 'Stripe billing is not configured');
    }
    if (!stripe.updateSubscriptionTip) {
      return problem(
        503,
        'Membership tip unavailable',
        'Stripe membership updates are not configured',
      );
    }
  }
  const updateSubscriptionTip = stripe?.updateSubscriptionTip?.bind(stripe);

  let result:
    | { kind: 'not_found' }
    | { kind: 'invalid'; title: string; detail: string }
    | { kind: 'provider_error' }
    | {
        kind: 'updated';
        row: {
          id: string;
          project_id: string;
          tier_id: string;
          status: string;
          current_period_end: Date | null;
          cancel_at_period_end: boolean;
          platform_tip_minor: string | number | bigint | null;
          currency: string | null;
        };
      };
  result = await db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('subscription')
      .select([
        'id',
        'project_id',
        'tier_id',
        'status',
        'current_period_end',
        'cancel_at_period_end',
        'stripe_subscription_id',
        'stripe_account_id',
        'platform_tip_minor',
        'currency',
        'cadence',
      ])
      .where('id', '=', event.params.id)
      .where('user_id', '=', session.userId)
      .forUpdate()
      .executeTakeFirst();
    if (!current) return { kind: 'not_found' as const };

    let platformTipMinor: bigint | undefined;
    if (requestedTip) {
      const tipAnchor = await trx
        .selectFrom('subscription')
        .select('id')
        .where('user_id', '=', session.userId)
        .where('status', '=', 'active')
        .where('cadence', 'in', ['monthly', 'annual'])
        .orderBy('created_at', 'asc')
        .orderBy('id', 'asc')
        .forUpdate()
        .executeTakeFirst();
      if (!tipAnchor || tipAnchor.id !== current.id) {
        return {
          kind: 'invalid' as const,
          title: 'Membership tip unavailable',
          detail: 'Only the oldest active recurring membership can change this tip',
        };
      }
      if (!['active', 'grace', 'past_due'].includes(current.status)) {
        return {
          kind: 'invalid' as const,
          title: 'Membership tip unavailable',
          detail: 'Only a current recurring membership can change its tip',
        };
      }
      if (current.cadence !== 'monthly' && current.cadence !== 'annual') {
        return {
          kind: 'invalid' as const,
          title: 'Membership tip unavailable',
          detail: 'Only a recurring membership can change its tip',
        };
      }
      const currency = current.currency?.toLowerCase();
      if (!currency || requestedTip.currency !== currency) {
        return {
          kind: 'invalid' as const,
          title: 'Invalid membership tip currency',
          detail: 'Tip currency must match membership currency',
        };
      }
      try {
        platformTipMinor = minorUnits(BigInt(requestedTip.amount), 'Recurring tip');
      } catch (error) {
        return {
          kind: 'invalid' as const,
          title: 'Invalid membership tip',
          detail: error instanceof Error ? error.message : 'Tip must use minor units',
        };
      }
      if (platformTipMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
        return {
          kind: 'invalid' as const,
          title: 'Invalid membership tip',
          detail: 'Tip exceeds supported minor-unit range',
        };
      }
      const currentTipMinor =
        current.platform_tip_minor === null ? 0n : BigInt(String(current.platform_tip_minor));
      if (platformTipMinor !== currentTipMinor) {
        if (!updateSubscriptionTip) throw new Error('Stripe membership updates are not configured');
        try {
          await updateSubscriptionTip({
            stripeAccountId: current.stripe_account_id,
            subscriptionId: current.stripe_subscription_id,
            currentTipMinor,
            platformTipMinor,
            currency,
            cadence: current.cadence,
            idempotencyKey,
          });
        } catch (error) {
          console.error('[membership] Stripe tip update failed', error);
          return { kind: 'provider_error' as const };
        }
      }
    }

    const updated = await trx
      .updateTable('subscription')
      .set({
        ...(body.cancel_at_period_end === undefined
          ? {}
          : { cancel_at_period_end: body.cancel_at_period_end }),
        ...(platformTipMinor === undefined ? {} : { platform_tip_minor: platformTipMinor }),
        updated_at: new Date(),
      })
      .where('id', '=', event.params.id)
      .where('user_id', '=', session.userId)
      .returning([
        'id',
        'project_id',
        'tier_id',
        'status',
        'current_period_end',
        'cancel_at_period_end',
        'platform_tip_minor',
        'currency',
      ])
      .executeTakeFirst();
    if (!updated) return { kind: 'not_found' as const };
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: session.userId },
          {
            action: 'membership.updated',
            resourceType: 'subscription',
            resourceId: updated.id,
            projectId: updated.project_id,
            metadata: {
              ...(body.cancel_at_period_end === undefined
                ? {}
                : { cancel_at_period_end: updated.cancel_at_period_end }),
              ...(platformTipMinor === undefined
                ? {}
                : { platform_tip_minor: platformTipMinor.toString() }),
            },
          },
        ),
      )
      .execute();
    return { kind: 'updated' as const, row: updated };
  });
  if (result.kind === 'not_found') return problem(404, 'Membership not found');
  if (result.kind === 'invalid') return problem(409, result.title, result.detail);
  if (result.kind === 'provider_error') {
    return problem(502, 'Membership tip unavailable', 'Unable to update Stripe membership billing');
  }
  return json(membershipPayload(result.row), { headers: { 'cache-control': 'private, no-store' } });
};
