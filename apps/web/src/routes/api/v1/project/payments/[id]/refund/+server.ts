import { RefundRequestSchema } from '@oss-tips/api-contracts';
import { createPaymentsRepository, emailNotificationJob } from '@oss-tips/db';
import {
  deriveIdempotencyKey,
  orchestrateRefund,
  createStripeClient,
  validateIdempotencyKey,
} from '@oss-tips/payments';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const rawIdempotencyKey = event.request.headers.get('idempotency-key')?.trim();
  if (!rawIdempotencyKey) {
    return problem(
      400,
      'Idempotency key required',
      'Refund requests must include a valid Idempotency-Key',
    );
  }
  let idempotencyKey: string;
  try {
    idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
  } catch {
    return problem(400, 'Invalid idempotency key');
  }
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.refund', 'supporters:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }
  const body = await readJson(event.request, RefundRequestSchema);
  if (body instanceof Response) return body;
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'stripe_account_id',
      'stripe_charge_id',
      'currency',
      'customer_charge_minor',
      'stripe_application_fee_minor',
      'stripe_application_fee_id',
    ])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!payment) return problem(404, 'Payment not found');
  if (!payment.stripe_charge_id)
    return problem(409, 'Payment cannot be refunded', 'Stripe charge is not available yet');

  const prior = await db
    .selectFrom('refund')
    .select(({ fn }) => [
      fn.sum('amount_minor').as('amount'),
      fn.sum('application_fee_refund_minor').as('fee'),
    ])
    .where('payment_id', '=', payment.id)
    .where('status', 'in', ['pending', 'succeeded'])
    .executeTakeFirst();
  const originalCharge = BigInt(String(payment.customer_charge_minor));
  const originalFee = BigInt(String(payment.stripe_application_fee_minor));
  const refundedCharge = BigInt(String(prior?.amount ?? 0));
  const refundedFee = BigInt(String(prior?.fee ?? 0));
  const refundKey = deriveIdempotencyKey(`${payment.id}:${idempotencyKey}`, 'refund');
  const existing = await db
    .selectFrom('refund')
    .select([
      'stripe_refund_id',
      'amount_minor',
      'application_fee_refund_minor',
      'stripe_application_fee_refund_id',
      'currency',
      'status',
      'reason',
    ])
    .where('payment_id', '=', payment.id)
    .where('idempotency_key', '=', refundKey)
    .executeTakeFirst();
  if (existing) {
    const requestedAmount =
      body.amount_minor === undefined
        ? BigInt(String(existing.amount_minor))
        : BigInt(body.amount_minor);
    if (
      String(existing.amount_minor) !== requestedAmount.toString() ||
      existing.reason !== body.reason ||
      existing.currency.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      return problem(409, 'Idempotency key already used', 'Retry with the original refund values');
    }
    return json(
      {
        refundId: existing.stripe_refund_id,
        status: existing.status,
        amountMinor: String(existing.amount_minor),
        applicationFeeRefundMinor: String(existing.application_fee_refund_minor),
        ...(existing.stripe_application_fee_refund_id
          ? { applicationFeeRefundId: existing.stripe_application_fee_refund_id }
          : {}),
      },
      { status: 202, headers: { 'cache-control': 'no-store' } },
    );
  }
  const remaining = originalCharge - refundedCharge;
  if (remaining <= 0n) return problem(409, 'Payment already refunded');
  const amount = body.amount_minor === undefined ? remaining : BigInt(body.amount_minor);
  if (originalFee > 0n && !payment.stripe_application_fee_id) {
    return problem(
      409,
      'Refund pending payment metadata',
      'Stripe application fee identity is not available yet; retry after payment reconciliation',
    );
  }
  let providerRefundId: string | undefined;
  try {
    const result = await orchestrateRefund(createStripeClient(process.env.STRIPE_SECRET_KEY), {
      stripeAccountId: payment.stripe_account_id,
      chargeId: payment.stripe_charge_id,
      refundAmountMinor: amount,
      currency: payment.currency,
      originalCustomerChargeMinor: originalCharge,
      originalApplicationFeeMinor: originalFee,
      previouslyRefundedCustomerChargeMinor: refundedCharge,
      previouslyRefundedApplicationFeeMinor: refundedFee,
      reason: body.reason,
      idempotencyKey: refundKey,
      ...(payment.stripe_application_fee_id
        ? { stripeApplicationFeeId: payment.stripe_application_fee_id }
        : {}),
    });
    providerRefundId = result.refundId;
    await db.transaction().execute(async (trx) => {
      const refundRowId = uuidv7();
      await trx
        .insertInto('refund')
        .values({
          id: refundRowId,
          payment_id: payment.id,
          stripe_refund_id: result.refundId,
          idempotency_key: refundKey,
          amount_minor: result.amountMinor,
          application_fee_refund_minor: result.applicationFeeRefundMinor,
          stripe_application_fee_refund_id: result.applicationFeeRefundId ?? null,
          currency: payment.currency,
          status: result.status,
          reason: body.reason,
        })
        .execute();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'payment.refund_requested',
              resourceType: 'payment',
              resourceId: payment.id,
              projectId: access.projectId,
              metadata: {
                amount_minor: result.amountMinor,
                refund_id: result.refundId,
                status: result.status,
              },
            },
          ),
        )
        .execute();
      if (result.status === 'succeeded') {
        await trx
          .insertInto('outbox_event')
          .values({
            id: uuidv7(),
            aggregate_type: 'payment',
            aggregate_id: payment.id,
            event_type: 'support.refunded',
            payload: { project_id: access.projectId, payment_id: payment.id },
            published_at: null,
          })
          .execute();
        await trx
          .insertInto('job')
          .values(
            emailNotificationJob({
              notification: 'refund',
              refund_id: refundRowId,
              event_id: refundRowId,
            }),
          )
          .execute();
      }
    });
    return json(result, { status: 202, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      let raced = await db
        .selectFrom('refund')
        .select([
          'stripe_refund_id',
          'amount_minor',
          'application_fee_refund_minor',
          'stripe_application_fee_refund_id',
          'currency',
          'status',
          'reason',
        ])
        .where('payment_id', '=', payment.id)
        .where('idempotency_key', '=', refundKey)
        .executeTakeFirst();
      if (!raced && providerRefundId) {
        raced = await db
          .selectFrom('refund')
          .select([
            'stripe_refund_id',
            'amount_minor',
            'application_fee_refund_minor',
            'stripe_application_fee_refund_id',
            'currency',
            'status',
            'reason',
          ])
          .where('payment_id', '=', payment.id)
          .where('stripe_refund_id', '=', providerRefundId)
          .executeTakeFirst();
      }
      if (raced) {
        if (
          String(raced.amount_minor) !== amount.toString() ||
          (raced.reason !== null && raced.reason !== body.reason) ||
          raced.currency.toLowerCase() !== payment.currency.toLowerCase()
        ) {
          return problem(
            409,
            'Idempotency key already used',
            'Retry with the original refund values',
          );
        }
        return json(
          {
            refundId: raced.stripe_refund_id,
            status: raced.status,
            amountMinor: String(raced.amount_minor),
            applicationFeeRefundMinor: String(raced.application_fee_refund_minor),
            ...(raced.stripe_application_fee_refund_id
              ? { applicationFeeRefundId: raced.stripe_application_fee_refund_id }
              : {}),
          },
          { status: 202, headers: { 'cache-control': 'no-store' } },
        );
      }
    }
    return problem(
      502,
      'Refund unavailable',
      error instanceof Error ? error.message : 'Stripe refund failed',
    );
  }
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
