import { checkPlatform, type PlatformCapability } from '@oss-tips/auth';
import { emailNotificationJob, type Db } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import {
  createStripeClient,
  deriveIdempotencyKey,
  orchestrateRefund,
  validateIdempotencyKey,
} from '@oss-tips/payments';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { auditRecord } from '../../routes/api/api-utils';
import { getDb, hasDatabaseUrl } from './db';
import {
  hasRecentAuthentication,
  recentAuthenticationRedirectPath,
  requirePlatformMembership,
} from './session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminContext = {
  db: Db;
  userId: string;
};

export type ReviewDecision = 'approved' | 'pending' | 'rejected';

export function readFormText(form: FormData, key: string, maxLength = 500): string | null {
  const value = form.get(key);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

export function readRequiredReason(form: FormData): string {
  const reason = readFormText(form, 'reason');
  if (!reason) throw error(400, 'Reason required: privileged changes need a written reason.');
  if (/[\r\n]/.test(reason)) throw error(400, 'Reason must be one line.');
  return reason;
}

export function readRequiredUuid(form: FormData, key: string): string {
  const value = readFormText(form, key, 64);
  if (!value || !UUID.test(value)) throw error(400, 'Invalid identifier');
  return value;
}

export function readMinorAmount(form: FormData): bigint | undefined {
  const value = readFormText(form, 'amountMinor', 32);
  if (!value) return undefined;
  if (!/^\d+$/.test(value))
    throw error(400, 'Invalid amount: use a positive integer in minor units.');
  const amount = BigInt(value);
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw error(400, 'Invalid amount: use a positive safe integer in minor units.');
  }
  return amount;
}

export function requireAdmin(event: RequestEvent, capability: PlatformCapability): AdminContext {
  const actor = requirePlatformMembership(event);
  if (!checkPlatform(actor, capability).allowed) throw error(403, 'Operator permission required');
  const userId = event.locals.session?.user.id;
  if (!userId) throw error(401, 'Authentication required');
  if (!hasDatabaseUrl())
    throw error(503, 'Database unavailable: admin actions require a database connection.');
  return { db: getDb(), userId };
}

export function reviewTransition(decision: ReviewDecision): {
  reviewStatus: ReviewDecision;
  projectStatus: 'pending_review' | 'published' | 'restricted';
} {
  if (decision === 'approved') return { reviewStatus: decision, projectStatus: 'published' };
  if (decision === 'rejected') return { reviewStatus: decision, projectStatus: 'restricted' };
  return { reviewStatus: decision, projectStatus: 'pending_review' };
}

export function adminRefundIdempotencyKey(paymentId: string, requestKey: string): string {
  return deriveIdempotencyKey(`admin:${paymentId}:${requestKey}`, 'refund');
}

export async function decideProjectReview(
  event: RequestEvent,
  decision: ReviewDecision,
): Promise<void> {
  const { db, userId } = requireAdmin(event, 'platform.review_projects');
  const form = await event.request.formData();
  const reviewId = readRequiredUuid(form, 'reviewId');
  const reason = readRequiredReason(form);
  const transition = reviewTransition(decision);
  const review = await db
    .selectFrom('project_review')
    .select(['id', 'project_id', 'status'])
    .where('id', '=', reviewId)
    .executeTakeFirst();
  if (!review) throw error(404, 'Review item not found');
  if (
    ['approved', 'rejected'].includes(review.status) &&
    review.status !== transition.reviewStatus
  ) {
    throw error(409, 'Review item already decided');
  }
  const project = await db
    .selectFrom('project')
    .select(['id', 'status'])
    .where('id', '=', review.project_id)
    .executeTakeFirst();
  if (!project) throw error(404, 'Project not found');

  await db.transaction().execute(async (trx) => {
    const now = new Date();
    const reviewUpdate = await trx
      .updateTable('project_review')
      .set({
        status: transition.reviewStatus,
        reviewer_id: userId,
        notes: reason,
        updated_at: now,
      })
      .where('id', '=', review.id)
      .where('status', '=', review.status)
      .execute();
    if (reviewUpdate[0]?.numUpdatedRows === 0n) throw error(409, 'Review item already decided');
    if (project.status !== transition.projectStatus) {
      const projectUpdate = await trx
        .updateTable('project')
        .set({ status: transition.projectStatus, updated_at: now })
        .where('id', '=', project.id)
        .where('status', '=', project.status)
        .execute();
      if (projectUpdate[0]?.numUpdatedRows === 0n)
        throw error(409, 'Project status changed; retry this review');
      await trx
        .insertInto('project_status_history')
        .values({
          id: uuidv7(),
          project_id: project.id,
          from_status: project.status,
          to_status: transition.projectStatus,
          reason,
          changed_by: userId,
        })
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: project.id,
          event_type: 'project.updated',
          payload: { project_id: project.id, status: transition.projectStatus },
          published_at: null,
        })
        .execute();
    }
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId },
          {
            action:
              decision === 'approved'
                ? 'project.review.approve'
                : decision === 'rejected'
                  ? 'project.review.reject'
                  : 'project.review.hold',
            resourceType: 'project_review',
            resourceId: review.id,
            projectId: project.id,
            metadata: {
              reason,
              review_status: transition.reviewStatus,
              from_project_status: project.status,
              to_project_status: transition.projectStatus,
            },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'project-review',
          project_id: project.id,
          review_id: review.id,
          status: decision === 'pending' ? 'action_required' : decision,
        }),
      )
      .execute();
  });
}

const CASE_STATUSES = new Set(['open', 'investigating', 'waiting', 'resolved']);

export async function updateCaseNote(event: RequestEvent): Promise<void> {
  const { db, userId } = requireAdmin(event, 'platform.review_projects');
  const form = await event.request.formData();
  const caseId = readRequiredUuid(form, 'caseId');
  const note = readRequiredReason(form);
  const current = await db
    .selectFrom('admin_case')
    .select(['id'])
    .where('id', '=', caseId)
    .executeTakeFirst();
  if (!current) throw error(404, 'Case not found');
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('admin_case')
      .set({ notes: note, updated_at: new Date() })
      .where('id', '=', caseId)
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId },
          {
            action: 'case.note.add',
            resourceType: 'admin_case',
            resourceId: caseId,
            metadata: { reason: note },
          },
        ),
      )
      .execute();
  });
}

export async function updateCaseStatus(event: RequestEvent): Promise<void> {
  const { db, userId } = requireAdmin(event, 'platform.review_projects');
  const form = await event.request.formData();
  const caseId = readRequiredUuid(form, 'caseId');
  const status = readFormText(form, 'status', 32);
  if (!status || !CASE_STATUSES.has(status)) throw error(400, 'Invalid case status');
  const reason = readRequiredReason(form);
  const current = await db
    .selectFrom('admin_case')
    .select(['id', 'status'])
    .where('id', '=', caseId)
    .executeTakeFirst();
  if (!current) throw error(404, 'Case not found');
  if (current.status === status) return;
  await db.transaction().execute(async (trx) => {
    const now = new Date();
    const caseUpdate = await trx
      .updateTable('admin_case')
      .set({ status, updated_at: now, resolved_at: status === 'resolved' ? now : null })
      .where('id', '=', caseId)
      .where('status', '=', current.status)
      .execute();
    if (caseUpdate[0]?.numUpdatedRows === 0n)
      throw error(409, 'Case status changed; retry this case action');
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId },
          {
            action: 'case.status.change',
            resourceType: 'admin_case',
            resourceId: caseId,
            metadata: { reason, from_status: current.status, to_status: status },
          },
        ),
      )
      .execute();
  });
}

export async function restrictCasePayments(event: RequestEvent): Promise<void> {
  const { db, userId } = requireAdmin(event, 'platform.review_projects');
  const form = await event.request.formData();
  const caseId = readRequiredUuid(form, 'caseId');
  const reason = readRequiredReason(form);
  const current = await db
    .selectFrom('admin_case')
    .select(['id', 'status', 'subject_type', 'subject_id'])
    .where('id', '=', caseId)
    .executeTakeFirst();
  if (!current) throw error(404, 'Case not found');
  if (current.subject_type !== 'project') throw error(409, 'Case has no project subject');
  const project = await db
    .selectFrom('project')
    .select(['id', 'status'])
    .where('id', '=', current.subject_id)
    .executeTakeFirst();
  if (!project) throw error(404, 'Project not found');
  if (project.status === 'suspended') throw error(409, 'Project is already suspended');
  await db.transaction().execute(async (trx) => {
    const now = new Date();
    if (project.status !== 'restricted') {
      const projectUpdate = await trx
        .updateTable('project')
        .set({ status: 'restricted', updated_at: now })
        .where('id', '=', project.id)
        .where('status', '=', project.status)
        .execute();
      if (projectUpdate[0]?.numUpdatedRows === 0n)
        throw error(409, 'Project status changed; retry this case action');
      await trx
        .insertInto('project_status_history')
        .values({
          id: uuidv7(),
          project_id: project.id,
          from_status: project.status,
          to_status: 'restricted',
          reason,
          changed_by: userId,
        })
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: project.id,
          event_type: 'project.updated',
          payload: { project_id: project.id, status: 'restricted' },
          published_at: null,
        })
        .execute();
    }
    if (current.status !== 'investigating') {
      const caseUpdate = await trx
        .updateTable('admin_case')
        .set({ status: 'investigating', resolved_at: null, updated_at: now })
        .where('id', '=', caseId)
        .where('status', '=', current.status)
        .execute();
      if (caseUpdate[0]?.numUpdatedRows === 0n)
        throw error(409, 'Case status changed; retry this case action');
    }
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId },
          {
            action: 'project.restrict.payments',
            resourceType: 'project',
            resourceId: project.id,
            projectId: project.id,
            metadata: {
              reason,
              case_id: caseId,
              from_status: project.status,
              to_status: 'restricted',
              case_from_status: current.status,
              case_to_status: 'investigating',
            },
          },
        ),
      )
      .execute();
  });
}

export async function issueExceptionalRefund(event: RequestEvent): Promise<void> {
  const { db, userId } = requireAdmin(event, 'platform.refund');
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    throw redirect(303, recentAuthenticationRedirectPath(event));
  }
  const form = await event.request.formData();
  const paymentId = readRequiredUuid(form, 'paymentId');
  const amount = readMinorAmount(form);
  const reason = readRequiredReason(form);
  const rawKey = readFormText(form, 'idempotencyKey', 255);
  if (!rawKey) throw error(400, 'Idempotency key required');
  let idempotencyKey: string;
  try {
    idempotencyKey = validateIdempotencyKey(rawKey);
  } catch {
    throw error(400, 'Invalid idempotency key');
  }
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'stripe_account_id',
      'stripe_charge_id',
      'currency',
      'customer_charge_minor',
      'stripe_application_fee_minor',
      'stripe_application_fee_id',
    ])
    .where('id', '=', paymentId)
    .executeTakeFirst();
  if (!payment) throw error(404, 'Payment not found');
  if (!payment.stripe_charge_id)
    throw error(409, 'Payment cannot be refunded: Stripe charge is not available yet.');
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
  const refundKey = adminRefundIdempotencyKey(payment.id, idempotencyKey);
  const existing = await db
    .selectFrom('refund')
    .select(['amount_minor', 'reason', 'currency'])
    .where('payment_id', '=', payment.id)
    .where('idempotency_key', '=', refundKey)
    .executeTakeFirst();
  if (existing) {
    const requestedAmount = amount ?? BigInt(String(existing.amount_minor));
    if (
      String(existing.amount_minor) !== requestedAmount.toString() ||
      existing.reason !== reason ||
      existing.currency.toLowerCase() !== payment.currency.toLowerCase()
    )
      throw error(409, 'Idempotency key already used');
    return;
  }
  const remaining = originalCharge - refundedCharge;
  if (remaining <= 0n) throw error(409, 'Payment already refunded');
  const refundAmount = amount ?? remaining;
  if (refundAmount > remaining) throw error(409, 'Refund exceeds refundable balance');
  if (originalFee > 0n && !payment.stripe_application_fee_id)
    throw error(409, 'Refund pending payment metadata');
  let result: Awaited<ReturnType<typeof orchestrateRefund>>;
  try {
    result = await orchestrateRefund(createStripeClient(process.env.STRIPE_SECRET_KEY), {
      stripeAccountId: payment.stripe_account_id,
      chargeId: payment.stripe_charge_id,
      refundAmountMinor: refundAmount,
      currency: payment.currency,
      originalCustomerChargeMinor: originalCharge,
      originalApplicationFeeMinor: originalFee,
      previouslyRefundedCustomerChargeMinor: refundedCharge,
      previouslyRefundedApplicationFeeMinor: refundedFee,
      reason,
      idempotencyKey: refundKey,
      ...(payment.stripe_application_fee_id
        ? { stripeApplicationFeeId: payment.stripe_application_fee_id }
        : {}),
    });
  } catch {
    throw error(502, 'Refund unavailable');
  }
  try {
    const refundRowId = uuidv7();
    await db.transaction().execute(async (trx) => {
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
          reason,
        })
        .execute();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId },
            {
              action: 'refund.exceptional',
              resourceType: 'payment',
              resourceId: payment.id,
              projectId: payment.project_id,
              metadata: {
                reason,
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
            payload: { project_id: payment.project_id, payment_id: payment.id },
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
  } catch (cause) {
    if (!isUniqueViolation(cause))
      throw error(500, 'Refund was issued but could not be recorded safely.');
    const raced = await db
      .selectFrom('refund')
      .select(['amount_minor', 'reason', 'currency'])
      .where('payment_id', '=', payment.id)
      .where('idempotency_key', '=', refundKey)
      .executeTakeFirst();
    if (!raced) throw error(500, 'Refund was issued but could not be recorded safely.');
    if (
      String(raced.amount_minor) !== refundAmount.toString() ||
      raced.reason !== reason ||
      raced.currency.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      throw error(409, 'Idempotency key already used');
    }
  }
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code?: string }).code === '23505'
  );
}
