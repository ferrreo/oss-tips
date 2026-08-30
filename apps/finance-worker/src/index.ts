import './instrumentation.js';
import {
  createEntitlementsRepository,
  createDb,
  dailyReconciliationJob,
  emailNotificationJob,
  createJobsRepository,
  createPaymentsRepository,
  createStripeEventsRepository,
  createSubscriptionsRepository,
  destroyDb,
  enqueueDiscordRoleSyncForUser,
  ensurePaymentThread,
  recordConfirmedConversion,
  STRIPE_EVENT_LEASE_TIMEOUT_MS,
  type JsonValue,
  type Job,
  type StripeEvent,
} from '@oss-tips/db';
import { createLedgerClient } from '@oss-tips/ledger';
import { createLogger, shutdownTelemetry } from '@oss-tips/observability';
import {
  computeDisputeCorrection,
  createStripeClient,
  isAllowedStripeWebhookEvent,
  isStripeEventNewer,
} from '@oss-tips/payments';
import { currencyExponent, uuidv7 } from '@oss-tips/domain';
import {
  extractDisputeMetadata,
  extractProviderObjectDetails,
  extractRefundEntries,
  extractRefundMetadata,
  extractSettlementMetadata,
  parseOneOffDuration,
  postDisputeTransition,
  postOneOffRefund,
  reconcileOneOffEntitlement as calculateOneOffEntitlement,
  settleOneOffPayment,
  shouldSettleOneOff,
  type LedgerCorrectionResult,
} from './settle-one-off.js';
import {
  expireDueMemberships,
  processMembershipEvent,
  processMembershipEventWithNotification,
  type MembershipLedgerPostingInput,
  type MembershipTransactionDeps,
  type MembershipRuntimeDeps,
} from './membership.js';
export { membershipNotificationEvent } from './membership.js';
import { enqueueGuestReceiptJob } from './guest-receipts.js';
import {
  PLATFORM_RECONCILIATION_ACCOUNT_ID,
  previousUtcDay,
  runDailyReconciliation,
  runPlatformReconciliation,
} from './reconciliation.js';

const log = createLogger('@oss-tips/finance-worker');
const POLL_MS = Number(process.env.FINANCE_WORKER_POLL_MS ?? 1_000);
const BATCH_SIZE = Number(process.env.FINANCE_WORKER_BATCH_SIZE ?? 10);
const FINANCE_QUEUE = 'finance';
const RECONCILIATION_JOB = 'reconciliation.daily';

type WorkerDb = ReturnType<typeof createDb>;
type JobWriter = Pick<WorkerDb, 'insertInto'>;
type DbExecutor = Pick<WorkerDb, 'insertInto' | 'selectFrom' | 'updateTable' | 'deleteFrom'>;

function createMembershipStore(database: WorkerDb) {
  return {
    ...createSubscriptionsRepository(database),
    entitlements: createEntitlementsRepository(database),
    payments: createPaymentsRepository(database),
  };
}

async function enqueueEmailNotification(
  db: JobWriter,
  payload: Record<string, string>,
): Promise<void> {
  await db.insertInto('job').values(emailNotificationJob(payload)).execute();
}

export async function persistLedgerPosting(
  db: DbExecutor,
  input: MembershipLedgerPostingInput,
): Promise<void> {
  const status = input.status ?? 'posted';
  const postingKind = input.semanticKey.split(':').at(-2) ?? 'unknown';
  const payload: JsonValue = {
    ...input.metadata,
    semantic_key: input.semanticKey,
    transfer_ids: [...input.transferIds],
  };
  const inserted = await db
    .insertInto('ledger_posting_intent')
    .values({
      id: uuidv7(),
      stripe_event_id: input.stripeEventId,
      stripe_account_id: input.stripeAccountId,
      payment_id: input.paymentId,
      posting_kind: postingKind,
      posting_version: 1,
      semantic_key: input.semanticKey,
      payload,
      status,
    })
    .onConflict((oc) => oc.column('semantic_key').doNothing())
    .returning('id')
    .executeTakeFirst();
  const intentId =
    inserted?.id ??
    (
      await db
        .selectFrom('ledger_posting_intent')
        .select('id')
        .where('semantic_key', '=', input.semanticKey)
        .executeTakeFirstOrThrow()
    ).id;
  if (status === 'pending') {
    // A retry must not turn an already completed intent back into pending.
    await db
      .updateTable('ledger_posting_intent')
      .set({ status, updated_at: new Date() })
      .where('id', '=', intentId)
      .where('status', '<>', 'posted')
      .execute();
    return;
  }
  await db
    .updateTable('ledger_posting_intent')
    .set({ status, updated_at: new Date() })
    .where('id', '=', intentId)
    .execute();
  await db
    .insertInto('ledger_posting_result')
    .values({
      id: uuidv7(),
      intent_id: intentId,
      tigerbeetle_transfer_ids: [...input.transferIds],
      status: 'posted',
      error: null,
      posted_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('intent_id').doUpdateSet({
        tigerbeetle_transfer_ids: [...input.transferIds],
        status: 'posted',
        error: null,
        posted_at: new Date(),
      }),
    )
    .execute();
}

async function enqueueDiscordRoleSync(
  db: DbExecutor,
  input: { projectId: string; userId: string },
): Promise<void> {
  await enqueueDiscordRoleSyncForUser(db, input);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function eventObject(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  return record(record(payload.data)?.object);
}

function eventMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const metadata = record(eventObject(payload)?.metadata);
  return metadata ?? {};
}

function eventCreatedAt(event: StripeEvent): number {
  const created = (event.payload as Record<string, unknown>).created;
  return typeof created === 'number' && Number.isSafeInteger(created) && created >= 0 ? created : 0;
}

function capabilityStatuses(value: unknown): Record<string, string> {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function accountRestriction(input: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  capabilities: Record<string, string>;
  deauthorized?: boolean;
}): string | null {
  if (input.deauthorized) return 'Stripe access for this project has been disconnected.';
  if (!input.chargesEnabled) return 'Stripe cannot accept payments for this project right now.';
  if (!input.payoutsEnabled) return 'Stripe payouts for this project are currently unavailable.';
  if (Object.values(input.capabilities).some((status) => status !== 'active')) {
    return 'A Stripe capability for this project needs attention.';
  }
  return null;
}

async function processStripeAccountEvent(
  db: WorkerDb,
  event: StripeEvent,
  type: string,
): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const object = eventObject(payload);
  const objectAccountId = typeof object?.id === 'string' ? object.id : undefined;
  const accountId = event.stripe_account_id ?? objectAccountId;
  if (!accountId) return;
  const created = eventCreatedAt(event);
  await db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('stripe_connected_account')
      .select([
        'id',
        'project_id',
        'charges_enabled',
        'payouts_enabled',
        'capabilities',
        'last_event_created',
        'last_event_id',
      ])
      .where('stripe_account_id', '=', accountId)
      .forUpdate()
      .executeTakeFirst();
    if (!current) return;

    const incomingOrder = { id: event.stripe_event_id, createdAt: created };
    const currentOrder = {
      id: current.last_event_id,
      createdAt: Number(current.last_event_created),
    };
    if (!isStripeEventNewer(incomingOrder, currentOrder)) return;

    const previousCapabilities = capabilityStatuses(current.capabilities);
    const incomingCapabilities = capabilityStatuses(object?.capabilities);
    const deauthorized = type === 'account.application.deauthorized';
    const chargesEnabled = deauthorized
      ? false
      : typeof object?.charges_enabled === 'boolean'
        ? object.charges_enabled
        : current.charges_enabled;
    const payoutsEnabled = deauthorized
      ? false
      : type === 'payout.failed'
        ? false
        : typeof object?.payouts_enabled === 'boolean'
          ? object.payouts_enabled
          : current.payouts_enabled;
    const capabilities = deauthorized
      ? {}
      : Object.keys(incomingCapabilities).length > 0
        ? incomingCapabilities
        : previousCapabilities;
    const previousRestriction = accountRestriction({
      chargesEnabled: current.charges_enabled,
      payoutsEnabled: current.payouts_enabled,
      capabilities: previousCapabilities,
    });
    const restriction = accountRestriction({
      chargesEnabled,
      payoutsEnabled,
      capabilities,
      ...(deauthorized ? { deauthorized: true } : {}),
    });
    const stateChanged =
      current.charges_enabled !== chargesEnabled ||
      current.payouts_enabled !== payoutsEnabled ||
      JSON.stringify(previousCapabilities) !== JSON.stringify(capabilities);
    const shouldNotify = restriction !== null && (stateChanged || previousRestriction === null);

    const updated = await trx
      .updateTable('stripe_connected_account')
      .set({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        capabilities: capabilities as JsonValue,
        last_event_created: String(created),
        last_event_id: event.stripe_event_id,
        updated_at: new Date(),
      })
      .where('id', '=', current.id)
      .where((eb) =>
        eb.or([
          eb('last_event_created', '<', String(created)),
          eb.and([
            eb('last_event_created', '=', String(created)),
            eb('last_event_id', '<', event.stripe_event_id),
          ]),
        ]),
      )
      .returningAll()
      .executeTakeFirst();
    if (!updated) return;

    for (const [capability, status] of Object.entries(capabilities)) {
      await trx
        .insertInto('stripe_capability_snapshot')
        .values({
          id: uuidv7(),
          connected_account_id: current.id,
          capability,
          status,
          snapshot_at: new Date(),
        })
        .execute();
    }
    if (shouldNotify && restriction) {
      await trx
        .insertInto('job')
        .values(
          emailNotificationJob({
            notification: 'stripe-restriction',
            project_id: current.project_id,
            event_id: event.stripe_event_id,
            restriction,
          }),
        )
        .execute();
    }
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

function canonicalPaymentPayload(
  payload: Record<string, unknown>,
  payment: {
    id: string;
    project_id: string;
    stripe_account_id: string;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    stripe_application_fee_id: string | null;
    currency: string;
    customer_charge_minor: string | number | bigint;
    project_amount_minor: string | number | bigint;
    platform_tip_minor: string | number | bigint;
    oss_project_fee_minor: string | number | bigint;
    stripe_application_fee_minor: string | number | bigint;
    cadence: string;
    feature_mode: string;
  },
  overrides: Record<string, string> = {},
): Record<string, unknown> {
  const object = eventObject(payload);
  if (!object) return payload;
  const metadata = {
    ...eventMetadata(payload),
    payment_id: payment.id,
    project_id: payment.project_id,
    currency: payment.currency,
    project_amount_minor: String(payment.project_amount_minor),
    platform_tip_minor: String(payment.platform_tip_minor),
    customer_charge_minor: String(payment.customer_charge_minor),
    oss_project_fee_minor: String(payment.oss_project_fee_minor),
    application_fee_minor: String(payment.stripe_application_fee_minor),
    cadence: payment.cadence,
    feature_mode: payment.feature_mode,
    ...(payment.stripe_payment_intent_id
      ? { payment_intent_id: payment.stripe_payment_intent_id }
      : {}),
    ...(payment.stripe_charge_id ? { charge_id: payment.stripe_charge_id } : {}),
    ...(payment.stripe_application_fee_id
      ? { application_fee_id: payment.stripe_application_fee_id }
      : {}),
    ...overrides,
  };
  return {
    ...payload,
    data: {
      ...record(payload.data),
      object: { ...object, metadata },
    },
  };
}

async function findPaymentForEvent(
  db: WorkerDb,
  event: StripeEvent,
  payload: Record<string, unknown>,
  details: { stripePaymentIntentId: string | null; stripeChargeId: string | null },
) {
  const metadataPaymentId = eventMetadata(payload).payment_id;
  const accountId =
    event.stripe_account_id ?? (typeof payload.account === 'string' ? payload.account : undefined);
  if (typeof metadataPaymentId === 'string' && metadataPaymentId) {
    let query = db.selectFrom('payment').selectAll().where('id', '=', metadataPaymentId);
    if (accountId) query = query.where('stripe_account_id', '=', accountId);
    const payment = await query.executeTakeFirst();
    if (payment) return payment;
  }
  if (details.stripeChargeId) {
    let query = db
      .selectFrom('payment')
      .selectAll()
      .where('stripe_charge_id', '=', details.stripeChargeId);
    if (accountId) query = query.where('stripe_account_id', '=', accountId);
    const payment = await query.executeTakeFirst();
    if (payment) return payment;
  }
  if (details.stripePaymentIntentId) {
    let query = db
      .selectFrom('payment')
      .selectAll()
      .where('stripe_payment_intent_id', '=', details.stripePaymentIntentId);
    if (accountId) query = query.where('stripe_account_id', '=', accountId);
    return query.executeTakeFirst();
  }
  return undefined;
}

async function persistProviderDetails(
  db: WorkerDb,
  event: StripeEvent,
  payload: Record<string, unknown>,
  details: {
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    stripeApplicationFeeId: string | null;
  },
) {
  const payment = await findPaymentForEvent(db, event, payload, details);
  if (!payment) return undefined;
  if (
    details.stripePaymentIntentId &&
    payment.stripe_payment_intent_id &&
    details.stripePaymentIntentId !== payment.stripe_payment_intent_id
  ) {
    throw new Error('Stripe payment intent does not match stored payment');
  }
  if (
    details.stripeChargeId &&
    payment.stripe_charge_id &&
    details.stripeChargeId !== payment.stripe_charge_id
  ) {
    throw new Error('Stripe charge does not match stored payment');
  }
  if (
    details.stripeApplicationFeeId &&
    payment.stripe_application_fee_id &&
    details.stripeApplicationFeeId !== payment.stripe_application_fee_id
  ) {
    throw new Error('Stripe application fee does not match stored payment');
  }
  const patch = {
    ...(details.stripePaymentIntentId && !payment.stripe_payment_intent_id
      ? { stripe_payment_intent_id: details.stripePaymentIntentId }
      : {}),
    ...(details.stripeChargeId && !payment.stripe_charge_id
      ? { stripe_charge_id: details.stripeChargeId }
      : {}),
    ...(details.stripeApplicationFeeId && !payment.stripe_application_fee_id
      ? { stripe_application_fee_id: details.stripeApplicationFeeId }
      : {}),
  };
  if (Object.keys(patch).length === 0) return payment;
  await db
    .updateTable('payment')
    .set({ ...patch, updated_at: new Date() })
    .where('id', '=', payment.id)
    .execute();
  return { ...payment, ...patch };
}

function disputeState(status: string): 'open' | 'won' | 'lost' | 'other' {
  if (status === 'won') return 'won';
  if (status === 'lost') return 'lost';
  if (
    status === 'needs_response' ||
    status === 'warning_needs_response' ||
    status === 'under_review'
  ) {
    return 'open';
  }
  return 'other';
}

function assertPaymentMatchesSettlement(
  payment: {
    project_id: string;
    stripe_account_id: string;
    currency: string;
    customer_charge_minor: string | number | bigint;
    project_amount_minor: string | number | bigint;
    platform_tip_minor: string | number | bigint;
    oss_project_fee_minor: string | number | bigint;
    stripe_application_fee_minor: string | number | bigint;
    cadence: string;
    feature_mode: string;
  },
  metadata: {
    projectId: string;
    stripeAccountId: string;
    currency: string;
    customerChargeMinor: bigint;
    projectAmountMinor: bigint;
    platformTipMinor: bigint;
    ossProjectFeeMinor: bigint;
    applicationFeeMinor: bigint;
    cadence: string;
    featureMode: string;
  },
): void {
  if (
    payment.project_id !== metadata.projectId ||
    payment.stripe_account_id !== metadata.stripeAccountId ||
    payment.currency.toLowerCase() !== metadata.currency ||
    String(payment.customer_charge_minor) !== metadata.customerChargeMinor.toString() ||
    String(payment.project_amount_minor) !== metadata.projectAmountMinor.toString() ||
    String(payment.platform_tip_minor) !== metadata.platformTipMinor.toString() ||
    String(payment.oss_project_fee_minor) !== metadata.ossProjectFeeMinor.toString() ||
    String(payment.stripe_application_fee_minor) !== metadata.applicationFeeMinor.toString() ||
    payment.cadence !== metadata.cadence ||
    payment.feature_mode !== metadata.featureMode
  ) {
    throw new Error('Stripe settlement does not match stored payment');
  }
}

export async function reconcileOneOffEntitlement(
  db: WorkerDb,
  paymentId: string,
  now = new Date(),
) {
  await db
    .transaction()
    .execute((trx) => reconcileOneOffEntitlementInTransaction(trx, paymentId, now));
}

async function reconcileOneOffEntitlementInTransaction(
  db: DbExecutor,
  paymentId: string,
  now: Date,
) {
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'user_id',
      'cadence',
      'status',
      'currency',
      'customer_charge_minor',
      'settled_at',
    ])
    .where('id', '=', paymentId)
    .forUpdate()
    .executeTakeFirst();
  if (!payment) return;
  // Entitlements and downstream access must follow a settled payment, never a
  // pending provider/ledger write. Refund/dispute callbacks can arrive before
  // settlement, so leave reconciliation for the settlement retry.
  if (!payment.settled_at || !['succeeded', 'refunded', 'disputed'].includes(payment.status)) {
    return;
  }
  if (payment.cadence !== 'one_off') {
    await reconcileRecurringEntitlementInTransaction(db, payment, now);
    if (payment.user_id) {
      await enqueueDiscordRoleSync(db, {
        projectId: payment.project_id,
        userId: payment.user_id,
      });
    }
    return;
  }

  const intent = await db
    .selectFrom('checkout_intent')
    .select('tier_id')
    .where('id', '=', payment.id)
    .where('project_id', '=', payment.project_id)
    .executeTakeFirst();
  if (!intent?.tier_id) {
    if (payment.user_id) {
      await enqueueDiscordRoleSync(db, {
        projectId: payment.project_id,
        userId: payment.user_id,
      });
    }
    return;
  }
  const tier = await db
    .selectFrom('tier')
    .select(['rank', 'one_off_duration'])
    .where('id', '=', intent.tier_id)
    .where('project_id', '=', payment.project_id)
    .executeTakeFirst();
  if (!tier) throw new Error('One-off entitlement tier is missing');
  const duration = parseOneOffDuration(tier.one_off_duration ?? 'none');
  const priorRefund = await db
    .selectFrom('refund')
    .select(({ fn }) => fn.sum('amount_minor').as('amount'))
    .where('payment_id', '=', payment.id)
    .where('status', '=', 'succeeded')
    .executeTakeFirst();
  const disputes = await db
    .selectFrom('payment_dispute')
    .select(['status', 'amount_minor'])
    .where('payment_id', '=', payment.id)
    .execute();
  const refunded = BigInt(String(priorRefund?.amount ?? 0));
  const activeDisputes = disputes.filter((dispute) => {
    const state = disputeState(dispute.status);
    return state === 'open' || state === 'lost';
  });
  const hasWonDispute = disputes.some((dispute) => disputeState(dispute.status) === 'won');
  const hasLostDispute = disputes.some((dispute) => disputeState(dispute.status) === 'lost');
  const disputed = activeDisputes.reduce(
    (total, dispute) => total + BigInt(String(dispute.amount_minor)),
    0n,
  );
  const original = BigInt(String(payment.customer_charge_minor));
  const startsAt = payment.settled_at ?? now;
  const reconciliation = calculateOneOffEntitlement({
    duration,
    startsAt,
    originalChargeMinor: original,
    refundedChargeMinor: refunded,
    disputedChargeMinor: disputed,
  });
  const existing = await db
    .selectFrom('entitlement')
    .selectAll()
    .where('payment_id', '=', payment.id)
    .where('kind', '=', 'one_off')
    .executeTakeFirst();
  const fullyRefunded = refunded >= original;
  const terminalReversal = fullyRefunded || (hasLostDispute && reconciliation.revoke);
  const revokedAt = terminalReversal ? (existing?.revoked_at ?? now) : null;
  const temporarilyEnded = reconciliation.revoke && !terminalReversal;
  const endsAt = temporarilyEnded ? now : reconciliation.endsAt;
  const transitionKey = `one_off:${payment.id}:grant`;
  if (!existing) {
    if (!reconciliation.grant) return;
    await db
      .insertInto('entitlement')
      .values({
        id: uuidv7(),
        project_id: payment.project_id,
        user_id: payment.user_id,
        tier_id: intent.tier_id,
        payment_id: payment.id,
        subscription_id: null,
        kind: 'one_off',
        tier_rank: tier.rank,
        starts_at: startsAt,
        ends_at: endsAt,
        revoked_at: revokedAt,
        transition_key: transitionKey,
      })
      .onConflict((oc) => oc.column('transition_key').doNothing())
      .execute();
    if (payment.user_id) {
      await enqueueDiscordRoleSync(db, {
        projectId: payment.project_id,
        userId: payment.user_id,
      });
    }
    return;
  }

  const canRestoreWonDispute =
    existing.revoked_at !== null &&
    hasWonDispute &&
    activeDisputes.length === 0 &&
    !fullyRefunded &&
    (reconciliation.endsAt === null || reconciliation.endsAt.getTime() >= now.getTime());
  const nextEndsAt = hasWonDispute
    ? reconciliation.endsAt
    : existing.revoked_at
      ? existing.ends_at
      : endsAt;
  const nextRevokedAt = canRestoreWonDispute ? null : (existing.revoked_at ?? revokedAt);

  await db
    .updateTable('entitlement')
    .set({
      user_id: payment.user_id,
      ends_at: nextEndsAt,
      revoked_at: nextRevokedAt,
      updated_at: now,
    })
    .where('id', '=', existing.id)
    .execute();

  if (payment.user_id) {
    await enqueueDiscordRoleSync(db, {
      projectId: payment.project_id,
      userId: payment.user_id,
    });
  }
}

type RecurringEntitlementPayment = {
  id: string;
  customer_charge_minor: string | number | bigint;
  cadence: string;
};

export function calculateRecurringEntitlement(args: {
  periodStart: Date;
  periodEnd: Date;
  originalChargeMinor: bigint;
  refundedChargeMinor: bigint;
  disputedChargeMinor: bigint;
}): { endsAt: Date; revoke: boolean } {
  if (args.originalChargeMinor <= 0n) {
    throw new Error('Original charge must be positive for recurring entitlement');
  }
  if (args.refundedChargeMinor < 0n || args.disputedChargeMinor < 0n) {
    throw new Error('Reversed charge amounts must be non-negative');
  }
  const reversed = args.refundedChargeMinor + args.disputedChargeMinor;
  const netSettled = args.originalChargeMinor > reversed ? args.originalChargeMinor - reversed : 0n;
  if (netSettled === 0n) return { endsAt: args.periodStart, revoke: true };

  const durationMs = BigInt(args.periodEnd.getTime() - args.periodStart.getTime());
  const endMs =
    BigInt(args.periodStart.getTime()) + (durationMs * netSettled) / args.originalChargeMinor;
  return { endsAt: new Date(Number(endMs)), revoke: false };
}

async function reconcileRecurringEntitlementInTransaction(
  db: DbExecutor,
  payment: RecurringEntitlementPayment,
  now: Date,
): Promise<void> {
  if (payment.cadence === 'one_off') return;

  const period = await db
    .selectFrom('subscription_period')
    .selectAll()
    .where('payment_id', '=', payment.id)
    .forUpdate()
    .executeTakeFirst();
  if (!period) return;

  const subscription = await db
    .selectFrom('subscription')
    .select(['id', 'status'])
    .where('id', '=', period.subscription_id)
    .forUpdate()
    .executeTakeFirst();
  if (!subscription) return;

  const entitlements = await db
    .selectFrom('entitlement')
    .selectAll()
    .where('payment_id', '=', payment.id)
    .where('subscription_id', '=', subscription.id)
    .where('kind', '=', 'membership')
    .forUpdate()
    .execute();
  if (entitlements.length === 0) return;

  const refundTotal = await db
    .selectFrom('refund')
    .select(({ fn }) => fn.sum('amount_minor').as('amount'))
    .where('payment_id', '=', payment.id)
    .where('status', '=', 'succeeded')
    .executeTakeFirst();
  const disputes = await db
    .selectFrom('payment_dispute')
    .select(['status', 'amount_minor'])
    .where('payment_id', '=', payment.id)
    .forUpdate()
    .execute();
  const refunded = BigInt(String(refundTotal?.amount ?? 0));
  const disputed = disputes.reduce(
    (total, dispute) =>
      disputeState(dispute.status) === 'open' || disputeState(dispute.status) === 'lost'
        ? total + BigInt(String(dispute.amount_minor))
        : total,
    0n,
  );
  const reconciliation = calculateRecurringEntitlement({
    periodStart: period.period_start,
    periodEnd: period.period_end,
    originalChargeMinor: BigInt(String(payment.customer_charge_minor)),
    refundedChargeMinor: refunded,
    disputedChargeMinor: disputed,
  });
  const eligible = ['active', 'grace'].includes(subscription.status) && period.period_end > now;
  const wonDispute = disputes.some((dispute) => disputeState(dispute.status) === 'won');

  for (const entitlement of entitlements) {
    const restore = eligible && (entitlement.revoked_at === null || wonDispute);
    const revokedAt = reconciliation.revoke
      ? (entitlement.revoked_at ?? now)
      : restore
        ? null
        : entitlement.revoked_at;
    const endsAt =
      reconciliation.revoke || restore || entitlement.revoked_at === null
        ? reconciliation.endsAt
        : entitlement.ends_at;
    await db
      .updateTable('entitlement')
      .set({ ends_at: endsAt, revoked_at: revokedAt, updated_at: now })
      .where('id', '=', entitlement.id)
      .execute();
  }
}

export async function reconcileRecurringEntitlement(
  db: WorkerDb,
  paymentId: string,
  now = new Date(),
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const payment = await trx
      .selectFrom('payment')
      .select([
        'id',
        'project_id',
        'user_id',
        'customer_charge_minor',
        'status',
        'cadence',
        'settled_at',
      ])
      .where('id', '=', paymentId)
      .forUpdate()
      .executeTakeFirst();
    if (!payment) return;
    if (!payment.settled_at || !['succeeded', 'refunded', 'disputed'].includes(payment.status)) {
      return;
    }
    await reconcileRecurringEntitlementInTransaction(trx, payment, now);
  });
}

async function saveRefundCorrection(
  db: WorkerDb,
  payment: { id: string; customer_charge_minor: string | number | bigint; status: string },
  metadata: { stripeRefundId: string; refundAmountMinor: bigint; currency: string },
  applicationFeeRefundMinor: bigint,
  now = new Date(),
) {
  const existing = await db
    .selectFrom('refund')
    .selectAll()
    .where('stripe_refund_id', '=', metadata.stripeRefundId)
    .executeTakeFirst();
  if (existing) {
    if (
      existing.payment_id !== payment.id ||
      String(existing.amount_minor) !== metadata.refundAmountMinor.toString() ||
      String(existing.application_fee_refund_minor) !== applicationFeeRefundMinor.toString() ||
      existing.currency.toLowerCase() !== metadata.currency
    ) {
      throw new Error('Stripe refund does not match stored correction');
    }
  } else {
    try {
      await db
        .insertInto('refund')
        .values({
          id: uuidv7(),
          payment_id: payment.id,
          stripe_refund_id: metadata.stripeRefundId,
          idempotency_key: metadata.stripeRefundId,
          amount_minor: metadata.refundAmountMinor,
          application_fee_refund_minor: applicationFeeRefundMinor,
          stripe_application_fee_refund_id: null,
          currency: metadata.currency,
          status: 'succeeded',
          reason: null,
        })
        .execute();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await db
        .selectFrom('refund')
        .selectAll()
        .where('stripe_refund_id', '=', metadata.stripeRefundId)
        .executeTakeFirst();
      if (
        !raced ||
        raced.payment_id !== payment.id ||
        String(raced.amount_minor) !== metadata.refundAmountMinor.toString() ||
        String(raced.application_fee_refund_minor) !== applicationFeeRefundMinor.toString() ||
        raced.currency.toLowerCase() !== metadata.currency
      ) {
        throw new Error('Stripe refund correction race did not converge');
      }
    }
  }

  const totals = await db
    .selectFrom('refund')
    .select(({ fn }) => fn.sum('amount_minor').as('amount'))
    .where('payment_id', '=', payment.id)
    .where('status', 'in', ['pending', 'succeeded'])
    .executeTakeFirst();
  if (BigInt(String(totals?.amount ?? 0)) >= BigInt(String(payment.customer_charge_minor))) {
    await db
      .updateTable('payment')
      .set({ status: 'refunded', updated_at: now })
      .where('id', '=', payment.id)
      .where('status', '=', 'succeeded')
      .execute();
  }
}

async function saveDisputeCursor(
  db: WorkerDb,
  payment: { id: string },
  metadata: { stripeDisputeId: string; disputeAmountMinor: bigint; currency: string },
  status: 'open' | 'won' | 'lost' | 'other',
  event: StripeEvent,
) {
  const created = eventCreatedAt(event);
  const existing = await db
    .selectFrom('payment_dispute')
    .selectAll()
    .where('stripe_dispute_id', '=', metadata.stripeDisputeId)
    .executeTakeFirst();
  if (existing && existing.payment_id !== payment.id) {
    throw new Error('Stripe dispute belongs to another payment');
  }
  if (
    existing &&
    !isStripeEventNewer(
      { id: event.stripe_event_id, createdAt: created },
      { id: existing.last_event_id, createdAt: Number(existing.last_event_created) },
    )
  )
    return existing;
  if (existing) {
    // Stripe dispute state is monotonic: a newer webhook must not reopen a
    // dispute that already reached a terminal outcome.
    const nextStatus =
      existing.status === 'won' || existing.status === 'lost' ? existing.status : status;
    return db
      .updateTable('payment_dispute')
      .set({
        status: nextStatus,
        amount_minor: metadata.disputeAmountMinor,
        currency: metadata.currency,
        last_event_created: String(created),
        last_event_id: event.stripe_event_id,
        updated_at: new Date(),
      })
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirst();
  }
  const inserted = await db
    .insertInto('payment_dispute')
    .values({
      id: uuidv7(),
      payment_id: payment.id,
      stripe_dispute_id: metadata.stripeDisputeId,
      status,
      amount_minor: metadata.disputeAmountMinor,
      currency: metadata.currency,
      last_event_created: String(created),
      last_event_id: event.stripe_event_id,
    })
    .onConflict((oc) => oc.column('stripe_dispute_id').doNothing())
    .returningAll()
    .executeTakeFirst();
  return (
    inserted ??
    (await db
      .selectFrom('payment_dispute')
      .selectAll()
      .where('stripe_dispute_id', '=', metadata.stripeDisputeId)
      .executeTakeFirst())
  );
}

export async function saveDisputeCursorAndNotify(
  db: WorkerDb,
  payment: { id: string },
  metadata: { stripeDisputeId: string; disputeAmountMinor: bigint; currency: string },
  status: 'open' | 'won' | 'lost' | 'other',
  event: StripeEvent,
): Promise<Awaited<ReturnType<typeof saveDisputeCursor>>> {
  return db.transaction().execute(async (trx) => {
    const saved = await saveDisputeCursor(trx, payment, metadata, status, event);
    if (saved && saved.last_event_id === event.stripe_event_id) {
      await enqueueEmailNotification(trx, {
        notification: 'dispute',
        dispute_id: saved.id,
        event_id: event.stripe_event_id,
      });
    }
    return saved;
  });
}

export async function processStripeEvent(
  event: StripeEvent,
  deps: {
    db: ReturnType<typeof createDb>;
    ledger: ReturnType<typeof createLedgerClient>;
    membership: Parameters<typeof processMembershipEvent>[1];
  },
): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const type = event.event_type || (typeof payload.type === 'string' ? payload.type : 'unknown');

  if (!isAllowedStripeWebhookEvent(type)) {
    throw new Error(`Unsupported stripe event type: ${type}`);
  }

  if (
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.deleted' ||
    type === 'invoice.created' ||
    type === 'invoice.finalized' ||
    type === 'invoice.finalization_failed' ||
    type === 'invoice.paid' ||
    type === 'invoice.payment_failed' ||
    type === 'invoice.payment_action_required'
  ) {
    const result = await processMembershipEventWithNotification(event, deps.membership);
    if (result.paymentId) {
      await reconcileRecurringEntitlement(deps.db, result.paymentId);
    }
    log.info('processed membership event', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      ...result,
    });
    return;
  }

  if (
    type === 'account.updated' ||
    type === 'account.application.deauthorized' ||
    type === 'payout.failed'
  ) {
    await processStripeAccountEvent(deps.db, event, type);
    log.info('acknowledged Stripe operational event', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      type,
    });
    return;
  }

  if (type === 'payment_intent.processing' || type === 'payment_intent.payment_failed') {
    const details = extractProviderObjectDetails(payload);
    if ('error' in details) throw new Error(details.error);
    const payment = await persistProviderDetails(deps.db, event, payload, details);
    if (!payment && details.stripePaymentIntentId) {
      throw new Error('Payment is not available yet');
    }
    if (payment) {
      await deps.db
        .updateTable('payment')
        .set({
          status: type === 'payment_intent.processing' ? 'processing' : 'failed',
          updated_at: new Date(),
        })
        .where('id', '=', payment.id)
        .where('status', 'in', ['pending', 'processing'])
        .execute();
    }
    return;
  }

  if (type === 'charge.succeeded') {
    const details = extractProviderObjectDetails(payload);
    if ('error' in details) throw new Error(details.error);
    await persistProviderDetails(deps.db, event, payload, details);
    return;
  }

  if (type === 'charge.refunded') {
    const details = extractProviderObjectDetails(payload);
    if ('error' in details) throw new Error(details.error);
    const payment = await persistProviderDetails(deps.db, event, payload, details);
    if (!payment) throw new Error('Refund payment is not available yet');
    const entries = extractRefundEntries(payload);
    if ('error' in entries) throw new Error(entries.error);
    if (entries.length === 0) throw new Error('Refund event has no individual refund amount');
    for (const entry of entries) {
      const refundPayload = canonicalPaymentPayload(payload, payment, {
        refund_id: entry.stripeRefundId,
        refund_amount_minor: entry.refundAmountMinor.toString(),
      });
      const extracted = extractRefundMetadata(
        refundPayload,
        event.stripe_account_id,
        entry.stripeRefundId,
      );
      if ('error' in extracted) throw new Error(extracted.error);
      const correction = await postOneOffRefund({ ledger: deps.ledger, metadata: extracted });
      if (!correction.ok) throw new Error(correction.error);
      await persistLedgerPosting(deps.db, {
        semanticKey: correction.semanticKey,
        stripeEventId: extracted.stripeRefundId,
        stripeAccountId: extracted.stripeAccountId,
        paymentId: extracted.paymentId,
        transferIds: correction.transferIds ?? [],
        metadata: {
          payment_id: extracted.paymentId,
          refund_id: extracted.stripeRefundId,
          currency: extracted.currency,
          amount_minor: extracted.refundAmountMinor.toString(),
        },
      });
      await saveRefundCorrection(
        deps.db,
        payment,
        extracted,
        correction.applicationFeeRefundMinor ?? 0n,
      );
      const refund = await deps.db
        .selectFrom('refund')
        .select('id')
        .where('stripe_refund_id', '=', entry.stripeRefundId)
        .executeTakeFirst();
      if (refund) {
        await enqueueEmailNotification(deps.db, {
          notification: 'refund',
          refund_id: refund.id,
          event_id: event.stripe_event_id,
        });
      }
    }
    await reconcileOneOffEntitlement(deps.db, payment.id);
    log.info('posted refund correction', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      paymentId: payment.id,
      refundCount: entries.length,
    });
    return;
  }

  if (
    type === 'charge.dispute.created' ||
    type === 'charge.dispute.updated' ||
    type === 'charge.dispute.closed'
  ) {
    const details = extractProviderObjectDetails(payload);
    if ('error' in details) throw new Error(details.error);
    const payment = await persistProviderDetails(deps.db, event, payload, details);
    if (!payment) throw new Error('Dispute payment is not available yet');
    const enrichedPayload = canonicalPaymentPayload(payload, payment);
    const extracted = extractDisputeMetadata(enrichedPayload, event.stripe_account_id);
    if ('error' in extracted) throw new Error(extracted.error);
    const incomingStatus = disputeState(extracted.disputeStatus);
    if (incomingStatus === 'other') {
      throw new Error(`Unsupported Stripe dispute status: ${extracted.disputeStatus}`);
    }
    const existing = await deps.db
      .selectFrom('payment_dispute')
      .selectAll()
      .where('stripe_dispute_id', '=', extracted.stripeDisputeId)
      .executeTakeFirst();
    if (existing && existing.payment_id !== payment.id) {
      throw new Error('Stripe dispute belongs to another payment');
    }
    const incomingOrder = { id: event.stripe_event_id, createdAt: eventCreatedAt(event) };
    const currentOrder = existing
      ? { id: existing.last_event_id, createdAt: Number(existing.last_event_created) }
      : undefined;
    if (existing && !isStripeEventNewer(incomingOrder, currentOrder)) {
      // The cursor may have committed before entitlement reconciliation in a
      // previous attempt. Equal/older retries must still repair access.
      await reconcileOneOffEntitlement(deps.db, payment.id);
      return;
    }
    if (existing && String(existing.amount_minor) !== extracted.disputeAmountMinor.toString()) {
      throw new Error('Stripe dispute amount does not match stored dispute');
    }
    const persistDisputePosting = async (correction: LedgerCorrectionResult): Promise<void> => {
      if (!correction.ok) throw new Error(correction.error);
      await persistLedgerPosting(deps.db, {
        semanticKey: correction.semanticKey,
        stripeEventId: extracted.stripeDisputeId,
        stripeAccountId: extracted.stripeAccountId,
        paymentId: extracted.paymentId,
        transferIds: correction.transferIds ?? [],
        metadata: {
          payment_id: extracted.paymentId,
          dispute_id: extracted.stripeDisputeId,
          currency: extracted.currency,
          amount_minor: extracted.disputeAmountMinor.toString(),
        },
      });
    };
    const previousStatus = existing ? disputeState(existing.status) : undefined;
    const correction = computeDisputeCorrection({
      eventType: type,
      status: extracted.disputeStatus,
      previousStatus: previousStatus === 'other' ? undefined : previousStatus,
      stripeDisputeId: extracted.stripeDisputeId,
      amountMinor: extracted.disputeAmountMinor,
      currency: extracted.currency,
    });
    if (!existing && correction.action !== 'opened') {
      const opened = await postDisputeTransition({
        ledger: deps.ledger,
        metadata: extracted,
        outcome: 'opened',
      });
      await persistDisputePosting(opened);
    }
    if (correction.action !== 'none' && correction.action !== 'opened') {
      const terminal = await postDisputeTransition({
        ledger: deps.ledger,
        metadata: extracted,
        outcome: correction.action,
      });
      await persistDisputePosting(terminal);
    } else if (correction.action === 'opened') {
      const opened = await postDisputeTransition({
        ledger: deps.ledger,
        metadata: extracted,
        outcome: 'opened',
      });
      await persistDisputePosting(opened);
    }
    const savedDispute = await saveDisputeCursorAndNotify(
      deps.db,
      payment,
      extracted,
      incomingStatus,
      event,
    );
    await reconcileOneOffEntitlement(deps.db, payment.id);
    log.info('processed dispute correction', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      paymentId: payment.id,
      action: correction.action,
    });
    return;
  }

  if (!shouldSettleOneOff(type)) {
    throw new Error(`Finance worker does not handle event type: ${type}`);
  }

  const extracted = extractSettlementMetadata(payload, event.stripe_account_id);
  if ('error' in extracted) {
    throw new Error(extracted.error);
  }

  await persistProviderDetails(deps.db, event, payload, {
    stripePaymentIntentId: extracted.stripePaymentIntentId,
    stripeChargeId: extracted.stripeChargeId ?? null,
    stripeApplicationFeeId: extracted.stripeApplicationFeeId ?? null,
  });

  const settlement = await settleOneOffPayment({
    ledger: deps.ledger,
    stripeEventId: event.stripe_event_id,
    metadata: extracted,
  });

  if (!settlement.ok) {
    if (settlement.skipped) {
      log.info('skipped settlement', {
        id: event.id,
        reason: settlement.error,
      });
      return;
    }
    throw new Error(settlement.error);
  }

  await persistLedgerPosting(deps.db, {
    semanticKey: settlement.semanticKey,
    stripeEventId: event.stripe_event_id,
    stripeAccountId: extracted.stripeAccountId,
    paymentId: extracted.paymentId,
    transferIds: settlement.transferIds ?? [],
    metadata: {
      payment_id: extracted.paymentId,
      project_id: extracted.projectId,
      currency: extracted.currency,
      customer_charge_minor: extracted.customerChargeMinor.toString(),
      project_amount_minor: extracted.projectAmountMinor.toString(),
    },
  });

  await deps.db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('payment')
      .selectAll()
      .where('id', '=', extracted.paymentId)
      .forUpdate()
      .executeTakeFirst();
    const settledAt = new Date();
    if (existing) {
      assertPaymentMatchesSettlement(existing, extracted);
      const settled = await createPaymentsRepository(trx).markSettled(existing.id, settledAt);
      if (!settled) throw new Error('One-off payment is missing during settlement');
      await trx
        .updateTable('payment')
        .set({
          exponent: currencyExponent(extracted.currency),
          updated_at: new Date(),
          ...(extracted.publicOptions
            ? {
                ...(extracted.receiptEmail ? { receipt_email: extracted.receiptEmail } : {}),
                public_show_name: extracted.publicOptions.showName,
                public_show_amount: extracted.publicOptions.showAmount,
                public_show_message: extracted.publicOptions.showMessage,
                public_display_name: extracted.publicOptions.displayName ?? null,
                public_message: extracted.publicOptions.message ?? null,
              }
            : extracted.receiptEmail
              ? { receipt_email: extracted.receiptEmail }
              : {}),
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      const publicOptions = extracted.publicOptions ?? {
        showName: false,
        showAmount: false,
        showMessage: false,
      };
      await trx
        .insertInto('payment')
        .values({
          id: extracted.paymentId,
          project_id: extracted.projectId,
          user_id: null,
          stripe_account_id: extracted.stripeAccountId,
          stripe_payment_intent_id: extracted.stripePaymentIntentId,
          stripe_charge_id: extracted.stripeChargeId ?? null,
          stripe_application_fee_id: extracted.stripeApplicationFeeId ?? null,
          currency: extracted.currency,
          exponent: currencyExponent(extracted.currency),
          customer_charge_minor: extracted.customerChargeMinor,
          project_amount_minor: extracted.projectAmountMinor,
          platform_tip_minor: extracted.platformTipMinor,
          oss_project_fee_minor: extracted.ossProjectFeeMinor,
          stripe_application_fee_minor: extracted.applicationFeeMinor,
          receipt_email: extracted.receiptEmail ?? null,
          public_show_name: publicOptions.showName,
          public_show_amount: publicOptions.showAmount,
          public_show_message: publicOptions.showMessage,
          public_display_name: publicOptions.displayName ?? null,
          public_message: publicOptions.message ?? null,
          status: 'succeeded',
          cadence: extracted.cadence,
          feature_mode: extracted.featureMode,
          settled_at: settledAt,
        })
        .execute();
    }

    if (
      type === 'checkout.session.completed' &&
      extracted.receiptEmail &&
      (!existing || existing.user_id === null)
    ) {
      await enqueueGuestReceiptJob({
        db: trx,
        paymentId: extracted.paymentId,
        eventId: event.stripe_event_id,
      });
    }
  });

  await ensurePaymentThread(deps.db, extracted.paymentId);
  await reconcileOneOffEntitlement(deps.db, extracted.paymentId);
  await recordConfirmedConversion(deps.db, {
    projectId: extracted.projectId,
    paymentId: extracted.paymentId,
  });

  log.info('settled one-off payment', {
    id: event.id,
    stripeEventId: event.stripe_event_id,
    paymentId: settlement.paymentId,
    transitBalance: settlement.transitBalance.toString(),
    semanticKey: settlement.semanticKey,
  });
}

async function processClaimedStripeEvent(
  event: StripeEvent,
  stripeEvents: ReturnType<typeof createStripeEventsRepository>,
  workerId: string,
  deps: Parameters<typeof processStripeEvent>[1],
): Promise<void> {
  const heartbeat = setInterval(
    () => {
      void stripeEvents
        .renewProcessingLease(event.id, workerId)
        .then((renewed) => {
          if (renewed) return;
          clearInterval(heartbeat);
          log.warn('Stripe event lease lost during handling', {
            id: event.id,
            stripeEventId: event.stripe_event_id,
          });
        })
        .catch((error: unknown) => {
          log.warn('Stripe event lease heartbeat failed', {
            id: event.id,
            error: String(error),
          });
        });
    },
    Math.max(1_000, Math.floor(STRIPE_EVENT_LEASE_TIMEOUT_MS / 2)),
  );
  try {
    await processStripeEvent(event, deps);
    const processed = await stripeEvents.markProcessed(event.id, workerId);
    if (!processed) {
      log.warn('Stripe event completion lost its lease', {
        id: event.id,
        stripeEventId: event.stripe_event_id,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await stripeEvents.markFailed(event.id, message, workerId);
    if (!failed) {
      log.warn('Stripe event failure lost its lease', {
        id: event.id,
        stripeEventId: event.stripe_event_id,
      });
    }
    log.error('stripe event failed', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      error: message,
    });
  } finally {
    clearInterval(heartbeat);
  }
}

type ReconciliationJobPayload = {
  stripe_account_id: string;
  currency: string;
  period_start: string;
  period_end: string;
  retry_kind?: 'timing' | 'event';
};

function reconciliationJobPayload(value: unknown): ReconciliationJobPayload {
  const payload = record(value);
  const stringField = (field: keyof ReconciliationJobPayload): string => {
    const candidate = payload?.[field];
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new Error(`Reconciliation job payload is missing ${field}`);
    }
    return candidate;
  };
  const retryKind = payload?.retry_kind;
  if (retryKind !== undefined && retryKind !== 'timing' && retryKind !== 'event') {
    throw new Error('Reconciliation job payload has invalid retry_kind');
  }
  return {
    stripe_account_id: stringField('stripe_account_id'),
    currency: stringField('currency'),
    period_start: stringField('period_start'),
    period_end: stringField('period_end'),
    ...(retryKind ? { retry_kind: retryKind } : {}),
  };
}

/** Enqueue one account/currency job for previous UTC day. */
async function enqueueDailyReconciliationJobs(
  db: WorkerDb,
  now: Date,
): Promise<{ periodEnd: string; count: number }> {
  const jobs = createJobsRepository(db);
  const { periodStart, periodEnd } = previousUtcDay(now);
  const accounts = await db
    .selectFrom('stripe_connected_account')
    .innerJoin('project', 'project.id', 'stripe_connected_account.project_id')
    .select(['stripe_connected_account.stripe_account_id', 'project.default_currency'])
    .execute();
  const paymentCurrencies = await db
    .selectFrom('payment')
    .select(['stripe_account_id', 'currency'])
    .distinct()
    .execute();
  const platformCurrencies = new Set<string>(accounts.map((account) => account.default_currency));
  const currenciesByAccount = new Map<string, Set<string>>();
  for (const account of accounts) {
    currenciesByAccount.set(account.stripe_account_id, new Set([account.default_currency]));
  }
  for (const row of paymentCurrencies) {
    platformCurrencies.add(row.currency);
    const currencies = currenciesByAccount.get(row.stripe_account_id);
    if (currencies) currencies.add(row.currency);
  }

  let count = 0;
  for (const [stripeAccountId, currencies] of currenciesByAccount) {
    for (const currency of [...currencies].sort()) {
      const job = dailyReconciliationJob(
        {
          stripeAccountId,
          currency,
          periodStart,
          periodEnd,
        },
        now,
      );
      const queued = await jobs.enqueueIfAbsent(job);
      if (queued) count += 1;
    }
  }
  for (const currency of [...platformCurrencies].sort()) {
    const job = dailyReconciliationJob(
      {
        stripeAccountId: PLATFORM_RECONCILIATION_ACCOUNT_ID,
        currency,
        periodStart,
        periodEnd,
      },
      now,
    );
    const queued = await jobs.enqueueIfAbsent(job);
    if (queued) count += 1;
  }
  return { periodEnd, count };
}

async function processFinanceJob(
  job: Job,
  deps: {
    db: WorkerDb;
    stripe: ReturnType<typeof createStripeClient>;
    ledger: ReturnType<typeof createLedgerClient>;
  },
): Promise<void> {
  if (job.kind !== RECONCILIATION_JOB) {
    throw new Error(`Finance worker does not handle job kind: ${job.kind}`);
  }
  const payload = reconciliationJobPayload(job.payload);
  const result =
    payload.stripe_account_id === PLATFORM_RECONCILIATION_ACCOUNT_ID
      ? await runPlatformReconciliation({
          db: deps.db,
          stripe: deps.stripe,
          ledger: deps.ledger,
          currency: payload.currency,
          periodStart: payload.period_start,
          periodEnd: payload.period_end,
          retry: payload.retry_kind === 'event',
        })
      : await runDailyReconciliation({
          db: deps.db,
          stripe: deps.stripe,
          ledger: deps.ledger,
          stripeAccountId: payload.stripe_account_id,
          currency: payload.currency,
          periodStart: payload.period_start,
          periodEnd: payload.period_end,
          retry: payload.retry_kind === 'event',
        });
  if (result.error) throw new Error(result.error);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required; finance worker refuses to start without a database');
  }

  const db = createDb(databaseUrl);
  const stripeEvents = createStripeEventsRepository(db);
  const jobs = createJobsRepository(db);
  const ledger = createLedgerClient(process.env);
  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  const workerId = `finance-${process.pid}-${uuidv7()}`;

  await jobs.recoverStaleLeases({ queue: FINANCE_QUEUE });

  const transaction: MembershipRuntimeDeps['transaction'] = async <T>(
    operation: (deps: MembershipTransactionDeps) => Promise<T>,
  ): Promise<T> => {
    const deferred: Array<
      (deps: {
        store: ReturnType<typeof createMembershipStore>;
        ledger: ReturnType<typeof createLedgerClient>;
        persistLedgerPosting: NonNullable<MembershipRuntimeDeps['persistLedgerPosting']>;
        transaction: MembershipRuntimeDeps['transaction'];
      }) => Promise<void>
    > = [];
    const result = await db.transaction().execute(async (trx) =>
      operation({
        store: createMembershipStore(trx),
        persistLedgerPosting: (input) => persistLedgerPosting(trx, input),
        deferAfterCommit: (callback) => deferred.push(callback),
        enqueueEmailNotification: (payload) => enqueueEmailNotification(trx, payload),
        notifyGraceEnding: (subscription) =>
          enqueueEmailNotification(trx, {
            notification: 'membership',
            subscription_id: subscription.id,
            event_id: `expiry_${subscription.id}_${subscription.grace_ends_at?.getTime() ?? 0}`,
            event: 'grace_ending',
          }),
      }),
    );
    const postCommitDeps = {
      store: createMembershipStore(db),
      ledger,
      persistLedgerPosting: (input: MembershipLedgerPostingInput) =>
        persistLedgerPosting(db, input),
      transaction,
    };
    for (const callback of deferred) await callback(postCommitDeps);
    return result;
  };

  const membership = {
    store: createMembershipStore(db),
    stripe,
    ledger,
    persistLedgerPosting: (input) => persistLedgerPosting(db, input),
    ensurePaymentThread: (paymentId: string) => ensurePaymentThread(db, paymentId),
    recordConfirmedConversion: ({ projectId, paymentId }) =>
      recordConfirmedConversion(db, { projectId, paymentId }),
    enqueueDiscordRoleSync: (input) => enqueueDiscordRoleSync(db, input),
    transaction,
  } satisfies MembershipRuntimeDeps;

  log.info('ready', {
    ledger: process.env.LEDGER_MODE === 'mock' ? 'mock' : 'tigerbeetle',
    workerId,
  });

  let scheduledPeriodEnd: string | undefined;
  const loop = async () => {
    try {
      const now = new Date();
      const schedule = previousUtcDay(now);
      if (scheduledPeriodEnd !== schedule.periodEnd) {
        const scheduled = await enqueueDailyReconciliationJobs(db, now);
        scheduledPeriodEnd = scheduled.periodEnd;
        if (scheduled.count > 0) {
          log.info('scheduled daily reconciliation', {
            periodStart: schedule.periodStart,
            periodEnd: schedule.periodEnd,
            count: scheduled.count,
          });
        }
      }
      const financeJob = await jobs.claimNext(FINANCE_QUEUE, workerId);
      if (financeJob) {
        try {
          await processFinanceJob(financeJob, { db, stripe, ledger });
          await jobs.complete(financeJob.id, workerId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await jobs.fail(financeJob.id, message, new Date(Date.now() + 30_000), workerId);
          log.error('reconciliation job failed', {
            jobId: financeJob.id,
            error: message,
          });
        }
      }
      await expireDueMemberships(membership);
      const batch = await stripeEvents.claimUnprocessed(BATCH_SIZE, workerId);

      for (const event of batch) {
        await processClaimedStripeEvent(event, stripeEvents, workerId, {
          db,
          ledger,
          membership,
        });
      }
    } catch (err) {
      log.error('finance worker loop error', { error: String(err) });
    } finally {
      setTimeout(loop, POLL_MS);
    }
  };

  void loop();

  const shutdown = async () => {
    log.info('shutting down');
    await destroyDb(db);
    await shutdownTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main().catch((err) => {
    log.error('fatal', { error: String(err) });
    process.exit(1);
  });
}
