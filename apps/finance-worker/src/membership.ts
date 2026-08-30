import { createHash } from 'node:crypto';
import {
  computeFeeAllocation,
  currencyExponent,
  feeRateBps,
  GRACE_PERIOD_MS,
  uuidv7,
  type Cadence,
  type FeatureMode,
} from '@oss-tips/domain';
import type {
  EntitlementsRepository,
  NewSubscription,
  PaymentsRepository,
  StripeEvent,
  Subscription,
  SubscriptionsRepository,
} from '@oss-tips/db';
import {
  AccountCode,
  accountId,
  ledgerForCurrency,
  replayIntents,
  transferId,
  TransferCode,
  type LedgerClient,
  type LedgerTransfer,
} from '@oss-tips/ledger';
import {
  applyInvoiceApplicationFee as applyStripeInvoiceApplicationFee,
  type StripeClient,
} from '@oss-tips/payments';

const MEMBERSHIP_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.created',
  'invoice.finalized',
  'invoice.finalization_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
]);
const PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableUuid(namespace: string, ...parts: string[]): string {
  const bytes = createHash('sha256')
    .update([namespace, ...parts].join('\n'))
    .digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type RecordValue = Record<string, unknown>;

type MembershipStore = Pick<
  SubscriptionsRepository,
  | 'findByStripeSubscriptionId'
  | 'findByIdForUpdate'
  | 'findTierRank'
  | 'createIfNew'
  | 'updateIfNewer'
  | 'listDueForExpiry'
  | 'markExpired'
  | 'createPeriodIfNew'
  | 'setPeriodPayment'
  | 'listPeriodsBySubscription'
> & {
  entitlements: Pick<
    EntitlementsRepository,
    'findByTransitionKey' | 'createIfNew' | 'setEndsAtForSubscription' | 'revokeForSubscription'
  >;
  payments: Pick<
    PaymentsRepository,
    'findById' | 'create' | 'updateProviderDetails' | 'markSettled'
  >;
};

export type MembershipLedgerPostingInput = {
  semanticKey: string;
  stripeEventId: string;
  stripeAccountId: string;
  paymentId: string;
  transferIds: readonly string[];
  metadata: Record<string, string>;
  status?: 'pending' | 'posted';
};

type MembershipPostCommitDeps = {
  store: MembershipStore;
  ledger: LedgerClient;
  persistLedgerPosting?: (input: MembershipLedgerPostingInput) => Promise<void>;
  transaction?: <T>(operation: (deps: MembershipTransactionDeps) => Promise<T>) => Promise<T>;
};

export type MembershipTransactionDeps = {
  store: MembershipStore;
  notifyGraceEnding: (subscription: Subscription) => Promise<unknown>;
  enqueueEmailNotification: (payload: Record<string, string>) => Promise<unknown>;
  /** Persist intent using the transaction connection. */
  persistLedgerPosting?: (input: MembershipLedgerPostingInput) => Promise<void>;
  /** Register external ledger work to run only after the transaction commits. */
  deferAfterCommit?: (operation: (deps: MembershipPostCommitDeps) => Promise<void>) => void;
};

export type MembershipRuntimeDeps = {
  store: MembershipStore;
  stripe: StripeClient;
  ledger: LedgerClient;
  persistLedgerPosting?: (input: MembershipLedgerPostingInput) => Promise<void>;
  enqueueEmailNotification?: (payload: Record<string, string>) => Promise<unknown>;
  /** Register external ledger work to run only after the enclosing transaction commits. */
  deferAfterCommit?: MembershipTransactionDeps['deferAfterCommit'];
  ensurePaymentThread?: (paymentId: string) => Promise<unknown>;
  /** Record conversion only after durable Stripe settlement has succeeded. */
  recordConfirmedConversion?: (input: { projectId: string; paymentId: string }) => Promise<unknown>;
  notifyGraceEnding?: (subscription: Subscription) => Promise<unknown>;
  enqueueDiscordRoleSync?: (input: { projectId: string; userId: string }) => Promise<unknown>;
  transaction: <T>(operation: (deps: MembershipTransactionDeps) => Promise<T>) => Promise<T>;
};

export type MembershipProcessResult = {
  kind: 'subscription_updated' | 'invoice_fee_applied' | 'invoice_settled' | 'acknowledged';
  projectId?: string;
  userId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentId?: string;
  firstSettlement?: boolean;
  applicationFeeMinor?: string;
  status?: string;
  subscriptionCreated?: boolean;
};

export function membershipNotificationEvent(
  stripeEventType: string,
  result: { status?: string; subscriptionCreated?: boolean; firstSettlement?: boolean },
): 'started' | 'renewed' | 'cancelled' | 'payment_failed' | undefined {
  if (stripeEventType === 'customer.subscription.created') {
    return undefined;
  }
  if (stripeEventType === 'customer.subscription.deleted') return 'cancelled';
  if (
    stripeEventType === 'invoice.payment_failed' ||
    stripeEventType === 'invoice.payment_action_required'
  ) {
    return 'payment_failed';
  }
  if (stripeEventType === 'invoice.paid') {
    return result.firstSettlement ? 'started' : 'renewed';
  }
  if (stripeEventType === 'customer.subscription.updated') {
    if (result.status === 'cancelled') return 'cancelled';
    if (result.status === 'grace') return 'payment_failed';
  }
  return undefined;
}

type Snapshot = {
  projectId: string;
  tierId: string;
  userId: string | null;
  stripeSubscriptionId: string;
  stripeAccountId: string;
  projectAmountMinor: bigint;
  platformTipMinor: bigint;
  currency: string;
  featureMode: FeatureMode;
  cadence: Exclude<Cadence, 'one_off'>;
  publicShowName: boolean;
  publicShowAmount: boolean;
  publicShowMessage: boolean;
  publicDisplayName: string | null;
  publicMessage: string | null;
  checkoutPaymentId: string | null;
};

type ParsedEvent = {
  eventId: string;
  payload: RecordValue;
  object: RecordValue;
  metadata: RecordValue;
  createdAt: number;
  stripeAccountId: string;
};

type MembershipState = {
  status: string;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};

export async function processMembershipEvent(
  event: StripeEvent,
  deps: MembershipRuntimeDeps,
  now = new Date(),
): Promise<MembershipProcessResult> {
  const type = event.event_type;
  if (!MEMBERSHIP_EVENT_TYPES.has(type)) {
    throw new Error(`Finance worker does not handle membership event type: ${type}`);
  }

  const parsed = parseEvent(event);
  if (type === 'invoice.created') {
    const invoice = parseInvoice(parsed, await findSubscription(parsed, deps.store));
    const result = await applyInvoiceFee(invoice, deps.stripe);
    return {
      kind: 'invoice_fee_applied',
      invoiceId: invoice.invoiceId,
      applicationFeeMinor: result.applicationFeeMinor,
      ...(invoice.subscriptionId ? { subscriptionId: invoice.subscriptionId } : {}),
    };
  }

  if (type === 'invoice.finalized' || type === 'invoice.finalization_failed') {
    const invoice = parseInvoice(parsed, await findSubscription(parsed, deps.store));
    if (type === 'invoice.finalized') validateInvoiceApplicationFee(invoice);
    return {
      kind: 'acknowledged',
      invoiceId: invoice.invoiceId,
      ...(invoice.subscriptionId ? { subscriptionId: invoice.subscriptionId } : {}),
    };
  }

  if (type === 'invoice.paid') {
    const existing = await findSubscription(parsed, deps.store);
    const invoice = parseInvoice(parsed, existing);
    const ensured = await ensureSubscription(
      parsed,
      invoice.snapshot,
      existing,
      invoice.state,
      deps.store,
    );
    const subscription = ensured.subscription;
    await validatePaidInvoice(invoice, subscription);
    let processedResult: MembershipProcessResult | undefined;
    const settlement = await settleInvoice(invoice, subscription, deps, async (finalized) => {
      if (processedResult) processedResult.firstSettlement = finalized.firstSettlement;
      await grantInvoiceEntitlement(invoice, subscription, finalized.paymentId, finalized.store);
      const eventName = membershipNotificationEvent(type, {
        firstSettlement: finalized.firstSettlement,
      });
      if (eventName) {
        await finalized.enqueueEmailNotification?.({
          notification: 'membership',
          subscription_id: subscription.id,
          event_id: parsed.eventId,
          event: eventName,
        });
      }
    });
    const paymentId = settlement.paymentId;
    if (!deps.deferAfterCommit) {
      await deps.ensurePaymentThread?.(paymentId);
      await deps.recordConfirmedConversion?.({
        projectId: invoice.snapshot.projectId,
        paymentId,
      });
    }
    const result: MembershipProcessResult = {
      kind: 'invoice_settled',
      projectId: invoice.snapshot.projectId,
      ...(subscription.user_id ? { userId: subscription.user_id } : {}),
      invoiceId: invoice.invoiceId,
      subscriptionId: subscription.id,
      paymentId,
      firstSettlement: settlement.firstSettlement,
      status: subscription.status,
      subscriptionCreated: ensured.created,
    };
    processedResult = result;
    return result;
  }

  if (type === 'invoice.payment_failed' || type === 'invoice.payment_action_required') {
    const existing = await findSubscription(parsed, deps.store);
    const invoice = parseInvoice(parsed, existing);
    const state = failureState(existing, now);
    const ensured = await ensureSubscription(parsed, invoice.snapshot, existing, state, deps.store);
    const subscription = ensured.subscription;
    if (ensured.applied && subscription.status === 'grace' && subscription.grace_ends_at) {
      await deps.store.entitlements.setEndsAtForSubscription(
        subscription.id,
        subscription.grace_ends_at,
      );
    }
    return {
      kind: 'subscription_updated',
      projectId: invoice.snapshot.projectId,
      ...((subscription.user_id ?? invoice.snapshot.userId)
        ? { userId: subscription.user_id ?? invoice.snapshot.userId! }
        : {}),
      subscriptionId: subscription.id,
      invoiceId: invoice.invoiceId,
      status: subscription.status,
    };
  }

  const existing = await findSubscription(parsed, deps.store);
  if (parsed.object.object !== 'subscription') {
    throw new Error('Subscription event contains a non-subscription object');
  }
  const snapshot = snapshotFromObject(parsed, existing);
  const state = subscriptionState(parsed.object, now, existing);
  const ensured = await ensureSubscription(parsed, snapshot, existing, state, deps.store);
  const subscription = ensured.subscription;
  if (ensured.applied && state.status === 'grace' && state.graceEndsAt) {
    await deps.store.entitlements.setEndsAtForSubscription(subscription.id, state.graceEndsAt);
  } else if (
    ensured.applied &&
    state.status === 'cancelled' &&
    state.currentPeriodEnd &&
    state.currentPeriodEnd > now
  ) {
    await deps.store.entitlements.setEndsAtForSubscription(subscription.id, state.currentPeriodEnd);
  } else if (ensured.applied && state.status === 'expired') {
    await deps.store.entitlements.revokeForSubscription(subscription.id, now);
  } else if (
    ensured.applied &&
    state.status === 'active' &&
    state.cancelAtPeriodEnd &&
    state.currentPeriodEnd
  ) {
    await deps.store.entitlements.setEndsAtForSubscription(subscription.id, state.currentPeriodEnd);
  }
  return {
    kind: 'subscription_updated',
    projectId: snapshot.projectId,
    ...((subscription.user_id ?? snapshot.userId)
      ? { userId: subscription.user_id ?? snapshot.userId! }
      : {}),
    subscriptionId: subscription.id,
    status: subscription.status,
    subscriptionCreated: ensured.created,
  };
}

/** Process membership state and its notification in one database transaction. */
export async function processMembershipEventWithNotification(
  event: StripeEvent,
  deps: MembershipRuntimeDeps,
  now = new Date(),
): Promise<MembershipProcessResult> {
  const result = await deps.transaction(async (transaction) => {
    const {
      ensurePaymentThread: _ensurePaymentThread,
      recordConfirmedConversion: _recordConfirmedConversion,
      persistLedgerPosting: _persistLedgerPosting,
      deferAfterCommit: _deferAfterCommit,
      ...baseDeps
    } = deps;
    const transactionalDeps: MembershipRuntimeDeps = {
      ...baseDeps,
      store: transaction.store,
      enqueueEmailNotification: transaction.enqueueEmailNotification,
      ...(transaction.persistLedgerPosting && transaction.deferAfterCommit
        ? {
            persistLedgerPosting: transaction.persistLedgerPosting,
            deferAfterCommit: transaction.deferAfterCommit,
          }
        : {}),
    };
    const processed = await processMembershipEvent(event, transactionalDeps, now);
    const eventName = membershipNotificationEvent(event.event_type, processed);
    if (eventName && processed.subscriptionId && event.event_type !== 'invoice.paid') {
      await transaction.enqueueEmailNotification({
        notification: 'membership',
        subscription_id: processed.subscriptionId,
        event_id: event.stripe_event_id,
        event: eventName,
      });
    }
    return processed;
  });

  if (result.paymentId) {
    await deps.ensurePaymentThread?.(result.paymentId);
  }
  if (result.paymentId && result.projectId) {
    await deps.recordConfirmedConversion?.({
      projectId: result.projectId,
      paymentId: result.paymentId,
    });
  }
  if (result.projectId && result.userId) {
    await deps.enqueueDiscordRoleSync?.({
      projectId: result.projectId,
      userId: result.userId,
    });
  }
  return result;
}

export async function expireDueMemberships(
  deps: Pick<MembershipRuntimeDeps, 'store' | 'transaction' | 'enqueueDiscordRoleSync'>,
  now = new Date(),
): Promise<number> {
  const due = await deps.store.listDueForExpiry(now);
  let expired = 0;
  for (const subscription of due) {
    const wasGrace = subscription.status === 'grace';
    const changed = await deps.transaction(async (transaction) => {
      const marked = await transaction.store.markExpired(subscription.id, now);
      if (!marked) return false;
      await transaction.store.entitlements.revokeForSubscription(subscription.id, now);
      if (wasGrace) await transaction.notifyGraceEnding(subscription);
      return true;
    });
    if (!changed) continue;
    expired += 1;
    if (subscription.user_id) {
      await deps.enqueueDiscordRoleSync?.({
        projectId: subscription.project_id,
        userId: subscription.user_id,
      });
    }
  }
  return expired;
}

function parseEvent(event: StripeEvent): ParsedEvent {
  const payload = record(event.payload, 'Stripe event payload');
  if (typeof payload.type === 'string' && payload.type !== event.event_type) {
    throw new Error('Stripe event type does not match durable inbox record');
  }
  const object = record(record(payload.data, 'Stripe event data').object, 'Stripe event object');
  const createdAt = integer(payload.created, 'Stripe event created timestamp');
  const accountFromPayload = optionalString(payload.account);
  const stripeAccountId = event.stripe_account_id ?? accountFromPayload;
  if (!stripeAccountId || !/^acct_[A-Za-z0-9_]+$/.test(stripeAccountId)) {
    throw new Error('Membership event is missing a valid connected account id');
  }
  if (
    event.stripe_account_id &&
    accountFromPayload &&
    event.stripe_account_id !== accountFromPayload
  ) {
    throw new Error('Stripe event account does not match durable inbox record');
  }
  return {
    eventId: event.stripe_event_id,
    payload,
    object,
    metadata: collectMetadata(object),
    createdAt,
    stripeAccountId,
  };
}

function parseInvoice(parsed: ParsedEvent, existing: Subscription | undefined): InvoiceDetails {
  if (parsed.object.object !== 'invoice')
    throw new Error('Invoice event contains a non-invoice object');
  const invoiceId = identifier(parsed.object.id, 'Invoice id', 'in_');
  const subscriptionId = subscriptionIdFromObject(parsed.object);
  if (!subscriptionId && !existing) {
    throw new Error('Invoice is missing subscription id');
  }
  if (subscriptionId && existing && existing.stripe_subscription_id !== subscriptionId) {
    throw new Error('Invoice subscription does not match stored membership');
  }
  const snapshot = snapshotFromObject(parsed, existing, subscriptionId);
  const period = invoicePeriod(parsed.object);
  const invoiceCurrency = optionalString(parsed.object.currency)?.toLowerCase();
  if (invoiceCurrency && invoiceCurrency !== snapshot.currency) {
    throw new Error('Invoice currency does not match membership snapshot');
  }
  validateProviderAmount(
    parsed.object,
    snapshot.projectAmountMinor + snapshot.platformTipMinor,
    parsed.payload.type === 'invoice.paid',
  );
  const providerApplicationFeeMinor = optionalMinor(parsed.object.application_fee_amount);
  const providerTotalMinor = firstMinor(parsed.object.total, parsed.object.amount_due);
  return {
    invoiceId,
    subscriptionId: subscriptionId ?? existing?.stripe_subscription_id ?? null,
    snapshot,
    period,
    state: {
      status: 'active',
      currentPeriodEnd: period.end,
      graceEndsAt: null,
      cancelAtPeriodEnd: existing?.cancel_at_period_end ?? false,
    },
    providerApplicationFeeMinor,
    providerTotalMinor,
    paymentIntentId: stringObjectId(parsed.object.payment_intent, 'Payment intent id', 'pi_'),
    chargeId: stringObjectId(parsed.object.charge, 'Charge id', 'ch_'),
    status: optionalString(parsed.object.status),
    autoAdvance: parsed.object.auto_advance === true,
    receiptEmail: invoiceReceiptEmail(parsed.object),
  };
}

type InvoiceDetails = {
  invoiceId: string;
  subscriptionId: string | null;
  snapshot: Snapshot;
  period: { start: Date; end: Date };
  state: MembershipState;
  providerApplicationFeeMinor: bigint | null;
  providerTotalMinor: bigint | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  status: string | null;
  autoAdvance: boolean;
  receiptEmail: string | null;
};

function snapshotFromObject(
  parsed: ParsedEvent,
  existing?: Subscription,
  subscriptionId = subscriptionIdFromObject(parsed.object),
): Snapshot {
  const metadata = parsed.metadata;
  const projectId = metadataString(metadata, 'project_id') ?? existing?.project_id ?? null;
  const tierId = metadataString(metadata, 'tier_id') ?? existing?.tier_id ?? null;
  const userId = metadataString(metadata, 'user_id') ?? existing?.user_id ?? null;
  const stripeSubscriptionId =
    subscriptionId ??
    existing?.stripe_subscription_id ??
    metadataString(metadata, 'subscription_id');
  const metadataSubscriptionId = metadataString(metadata, 'subscription_id');
  const checkoutPaymentId = metadataString(metadata, 'payment_id');
  const stripeAccountId = parsed.stripeAccountId;
  const projectAmountMinor =
    metadataMinor(metadata, 'project_amount_minor') ?? dbMinor(existing?.project_amount_minor);
  const platformTipMinor =
    metadataMinor(metadata, 'platform_tip_minor') ?? dbMinor(existing?.platform_tip_minor);
  const currency =
    metadataString(metadata, 'currency')?.toLowerCase() ??
    existing?.currency?.toLowerCase() ??
    null;
  const featureMode = metadataString(metadata, 'feature_mode') ?? existing?.feature_mode ?? null;
  const cadence = metadataString(metadata, 'cadence') ?? existing?.cadence ?? null;

  if (!projectId || !tierId || !stripeSubscriptionId) {
    throw new Error('Membership metadata incomplete (project_id/tier_id/subscription)');
  }
  if (metadataSubscriptionId && metadataSubscriptionId !== stripeSubscriptionId) {
    throw new Error('Membership subscription id does not match Stripe object');
  }
  if (
    projectAmountMinor === null ||
    platformTipMinor === null ||
    !currency ||
    !featureMode ||
    !cadence
  ) {
    throw new Error('Membership metadata incomplete (amount/currency/feature_mode/cadence)');
  }
  if (!/^monthly$|^annual$/.test(cadence)) throw new Error('Membership cadence is invalid');
  if (checkoutPaymentId !== null && !PAYMENT_ID_PATTERN.test(checkoutPaymentId)) {
    throw new Error('Membership payment id is invalid');
  }
  const normalizedCadence: Exclude<Cadence, 'one_off'> =
    cadence === 'annual' ? 'annual' : 'monthly';
  if (featureMode !== 'standard' && featureMode !== 'contributes_5_percent') {
    throw new Error('Membership feature mode is invalid');
  }
  if (projectAmountMinor < 0n || platformTipMinor < 0n) {
    throw new Error('Membership amounts must be non-negative');
  }
  if (projectAmountMinor === 0n) throw new Error('Membership amount must be positive');
  if (existing) {
    if (existing.project_id !== projectId || existing.tier_id !== tierId) {
      throw new Error('Membership identity does not match stored subscription');
    }
    if (existing.stripe_account_id !== stripeAccountId) {
      throw new Error('Membership account does not match stored subscription');
    }
    if (existing.user_id && userId && existing.user_id !== userId) {
      throw new Error('Membership supporter does not match stored subscription');
    }
    if (
      dbMinor(existing.project_amount_minor) !== null &&
      dbMinor(existing.project_amount_minor) !== projectAmountMinor
    ) {
      throw new Error('Membership amount does not match stored subscription');
    }
    if (
      dbMinor(existing.platform_tip_minor) !== null &&
      dbMinor(existing.platform_tip_minor) !== platformTipMinor
    ) {
      throw new Error('Membership tip does not match stored subscription');
    }
  }

  const allocation = computeFeeAllocation({
    projectAmountMinor,
    platformTipMinor,
    currency,
    featureMode,
    cadence: normalizedCadence,
  });
  for (const [key, expected] of [
    ['oss_project_fee_minor', allocation.ossProjectFee.amountMinor],
    ['application_fee_minor', allocation.stripeApplicationFee.amountMinor],
    ['customer_charge_minor', allocation.customerCharge.amountMinor],
  ] as const) {
    const supplied = metadataMinor(metadata, key);
    if (supplied !== null && supplied !== expected) {
      throw new Error(`Membership metadata ${key} does not match server allocation`);
    }
  }

  return {
    projectId,
    tierId,
    userId,
    stripeSubscriptionId,
    stripeAccountId,
    projectAmountMinor,
    platformTipMinor,
    currency,
    featureMode,
    cadence: normalizedCadence,
    publicShowName: metadataBoolean(metadata, 'show_name'),
    publicShowAmount: metadataBoolean(metadata, 'show_amount'),
    publicShowMessage: metadataBoolean(metadata, 'show_message'),
    publicDisplayName: publicText(metadataString(metadata, 'display_name'), 120, 'display name'),
    publicMessage: publicText(metadataString(metadata, 'public_message'), 2000, 'message', true),
    checkoutPaymentId,
  };
}

function subscriptionState(
  object: RecordValue,
  now: Date,
  existing?: Subscription,
): MembershipState {
  const periodEnd =
    optionalUnixDate(object.current_period_end) ?? existing?.current_period_end ?? null;
  const cancelAtPeriodEnd =
    typeof object.cancel_at_period_end === 'boolean'
      ? object.cancel_at_period_end
      : (existing?.cancel_at_period_end ?? false);
  const providerStatus = optionalString(object.status);
  if (!providerStatus) throw new Error('Subscription event missing status');
  if (providerStatus === 'trialing') throw new Error('Free trials are not supported');
  if (providerStatus === 'active') {
    return { status: 'active', currentPeriodEnd: periodEnd, graceEndsAt: null, cancelAtPeriodEnd };
  }
  if (providerStatus === 'past_due' || providerStatus === 'unpaid') {
    return {
      status: existing?.status === 'active' || existing?.status === 'grace' ? 'grace' : 'past_due',
      currentPeriodEnd: periodEnd,
      graceEndsAt:
        existing?.status === 'active' || existing?.status === 'grace'
          ? new Date(now.getTime() + GRACE_PERIOD_MS)
          : null,
      cancelAtPeriodEnd,
    };
  }
  if (providerStatus === 'canceled' || providerStatus === 'cancelled') {
    return {
      status: periodEnd && periodEnd > now ? 'cancelled' : 'expired',
      currentPeriodEnd: periodEnd,
      graceEndsAt: null,
      cancelAtPeriodEnd: true,
    };
  }
  if (providerStatus === 'incomplete_expired') {
    return { status: 'expired', currentPeriodEnd: periodEnd, graceEndsAt: null, cancelAtPeriodEnd };
  }
  if (providerStatus === 'incomplete' || providerStatus === 'paused') {
    return {
      status: 'incomplete',
      currentPeriodEnd: periodEnd,
      graceEndsAt: null,
      cancelAtPeriodEnd,
    };
  }
  throw new Error(`Unsupported Stripe subscription status: ${providerStatus}`);
}

function failureState(existing: Subscription | undefined, now: Date): MembershipState {
  if (existing?.status === 'cancelled' || existing?.status === 'expired') {
    return {
      status: existing.status,
      currentPeriodEnd: existing.current_period_end,
      graceEndsAt: null,
      cancelAtPeriodEnd: existing.cancel_at_period_end,
    };
  }
  const active = existing?.status === 'active' || existing?.status === 'grace';
  return {
    status: active ? 'grace' : 'past_due',
    currentPeriodEnd: existing?.current_period_end ?? null,
    graceEndsAt: active ? new Date(now.getTime() + GRACE_PERIOD_MS) : null,
    cancelAtPeriodEnd: existing?.cancel_at_period_end ?? false,
  };
}

async function ensureSubscription(
  parsed: ParsedEvent,
  snapshot: Snapshot,
  existing: Subscription | undefined,
  state: MembershipState,
  store: MembershipStore,
): Promise<{ subscription: Subscription; applied: boolean; created: boolean }> {
  const eventId = parsed.eventId;
  if (!/^evt_[A-Za-z0-9_]+$/.test(eventId)) throw new Error('Membership event id is invalid');
  const newRow: NewSubscription = {
    id: uuidv7(),
    project_id: snapshot.projectId,
    user_id: snapshot.userId,
    tier_id: snapshot.tierId,
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    stripe_account_id: snapshot.stripeAccountId,
    status: state.status,
    current_period_end: state.currentPeriodEnd,
    grace_ends_at: state.graceEndsAt,
    cancel_at_period_end: state.cancelAtPeriodEnd,
    project_amount_minor: snapshot.projectAmountMinor,
    platform_tip_minor: snapshot.platformTipMinor,
    currency: snapshot.currency,
    feature_mode: snapshot.featureMode,
    cadence: snapshot.cadence,
    last_event_created: String(parsed.createdAt),
    last_event_id: eventId,
  };
  if (!existing) {
    const created = await store.createIfNew(newRow);
    return {
      subscription: created.subscription,
      applied: created.created,
      created: created.created,
    };
  }
  const updated = await store.updateIfNewer(
    existing.id,
    { createdAt: parsed.createdAt, id: eventId },
    {
      status: state.status,
      current_period_end: state.currentPeriodEnd,
      grace_ends_at: state.graceEndsAt,
      cancel_at_period_end: state.cancelAtPeriodEnd,
      project_amount_minor: snapshot.projectAmountMinor,
      platform_tip_minor: snapshot.platformTipMinor,
      currency: snapshot.currency,
      feature_mode: snapshot.featureMode,
      cadence: snapshot.cadence,
    },
  );
  return { subscription: updated ?? existing, applied: updated !== undefined, created: false };
}

async function findSubscription(
  parsed: ParsedEvent,
  store: MembershipStore,
): Promise<Subscription | undefined> {
  const id = subscriptionIdFromObject(parsed.object);
  if (!id) return undefined;
  return store.findByStripeSubscriptionId(id);
}

async function applyInvoiceFee(
  invoice: InvoiceDetails,
  stripe: StripeClient,
): Promise<{ applicationFeeMinor: string }> {
  const allocation = computeFeeAllocation({
    projectAmountMinor: invoice.snapshot.projectAmountMinor,
    platformTipMinor: invoice.snapshot.platformTipMinor,
    currency: invoice.snapshot.currency,
    featureMode: invoice.snapshot.featureMode,
    cadence: invoice.snapshot.cadence,
  });
  const expected = allocation.stripeApplicationFee.amountMinor;
  if (
    invoice.providerApplicationFeeMinor !== null &&
    invoice.providerApplicationFeeMinor !== expected &&
    invoice.status !== null &&
    invoice.status !== 'draft'
  ) {
    throw new Error('Finalized invoice application fee does not match server allocation');
  }
  const invoiceStatus = invoice.status;
  if (
    invoice.providerApplicationFeeMinor === expected &&
    invoiceStatus &&
    invoiceStatus !== 'draft'
  ) {
    return { applicationFeeMinor: expected.toString() };
  }
  const result = await applyStripeInvoiceApplicationFee(stripe, {
    stripeAccountId: invoice.snapshot.stripeAccountId,
    invoiceId: invoice.invoiceId,
    projectMembershipAmountMinor: invoice.snapshot.projectAmountMinor,
    projectFeeRateBps: feeRateBps(invoice.snapshot.featureMode, invoice.snapshot.cadence),
    supporterPlatformTipMinor: invoice.snapshot.platformTipMinor,
    currency: invoice.snapshot.currency,
    ...(invoice.providerTotalMinor !== null
      ? { invoiceTotalMinor: invoice.providerTotalMinor }
      : {}),
    idempotencyKey: `membership-invoice-fee:${invoice.snapshot.stripeAccountId}:${invoice.invoiceId}`,
    finalize: invoiceStatus === 'draft' && invoice.autoAdvance,
  });
  return { applicationFeeMinor: result.applicationFeeMinor };
}

async function validatePaidInvoice(
  invoice: InvoiceDetails,
  subscription: Subscription,
): Promise<void> {
  if (invoice.subscriptionId !== subscription.stripe_subscription_id) {
    throw new Error('Paid invoice subscription does not match stored membership');
  }
  validateInvoiceApplicationFee(invoice);
}

function validateInvoiceApplicationFee(invoice: InvoiceDetails): void {
  const expected = computeFeeAllocation({
    projectAmountMinor: invoice.snapshot.projectAmountMinor,
    platformTipMinor: invoice.snapshot.platformTipMinor,
    currency: invoice.snapshot.currency,
    featureMode: invoice.snapshot.featureMode,
    cadence: invoice.snapshot.cadence,
  }).stripeApplicationFee.amountMinor;
  if (invoice.providerApplicationFeeMinor === null) {
    throw new Error('Invoice is missing application fee amount');
  }
  if (invoice.providerApplicationFeeMinor !== expected) {
    throw new Error('Invoice application fee does not match server allocation');
  }
}

async function settleInvoice(
  invoice: InvoiceDetails,
  subscription: Subscription,
  deps: MembershipRuntimeDeps,
  onFinalized: (input: {
    paymentId: string;
    firstSettlement: boolean;
    store: MembershipStore;
    enqueueEmailNotification?: MembershipTransactionDeps['enqueueEmailNotification'];
  }) => Promise<void>,
): Promise<{ paymentId: string; firstSettlement: boolean }> {
  const hadSettledPayment = await hasSettledMembershipPayment(subscription.id, deps.store);
  const periodResult = await deps.store.createPeriodIfNew({
    id: stableUuid(
      'oss.tips/membership-period',
      invoice.snapshot.stripeAccountId,
      invoice.invoiceId,
    ),
    subscription_id: subscription.id,
    stripe_invoice_id: invoice.invoiceId,
    period_start: invoice.period.start,
    period_end: invoice.period.end,
    payment_id: null,
  });
  // Checkout already created a pending payment before Stripe redirected the
  // supporter. Reuse it for first settlement so success URLs resolve to the
  // settled row instead of a second period-only payment.
  const checkoutPayment =
    !hadSettledPayment && invoice.snapshot.checkoutPaymentId
      ? await deps.store.payments.findById(invoice.snapshot.checkoutPaymentId)
      : undefined;
  const paymentId = periodResult.period.payment_id ?? checkoutPayment?.id ?? periodResult.period.id;
  const allocation = computeFeeAllocation({
    projectAmountMinor: invoice.snapshot.projectAmountMinor,
    platformTipMinor: invoice.snapshot.platformTipMinor,
    currency: invoice.snapshot.currency,
    featureMode: invoice.snapshot.featureMode,
    cadence: invoice.snapshot.cadence,
  });
  const existing = await deps.store.payments.findById(paymentId);
  if (existing) {
    if (
      existing.project_id !== invoice.snapshot.projectId ||
      existing.user_id !== subscription.user_id ||
      existing.stripe_account_id !== invoice.snapshot.stripeAccountId ||
      existing.currency.toLowerCase() !== invoice.snapshot.currency ||
      existing.cadence !== invoice.snapshot.cadence ||
      existing.feature_mode !== invoice.snapshot.featureMode ||
      (invoice.paymentIntentId !== null &&
        existing.stripe_payment_intent_id !== null &&
        existing.stripe_payment_intent_id !== invoice.paymentIntentId) ||
      (invoice.chargeId !== null &&
        existing.stripe_charge_id !== null &&
        existing.stripe_charge_id !== invoice.chargeId) ||
      BigInt(String(existing.customer_charge_minor)) !== allocation.customerCharge.amountMinor ||
      BigInt(String(existing.project_amount_minor)) !== allocation.projectAmount.amountMinor ||
      BigInt(String(existing.platform_tip_minor)) !== allocation.platformTip.amountMinor ||
      BigInt(String(existing.oss_project_fee_minor)) !== allocation.ossProjectFee.amountMinor ||
      BigInt(String(existing.stripe_application_fee_minor)) !==
        allocation.stripeApplicationFee.amountMinor
    ) {
      throw new Error('Recurring payment does not match invoice allocation');
    }
  } else {
    await deps.store.payments.create({
      id: paymentId,
      project_id: invoice.snapshot.projectId,
      user_id: subscription.user_id,
      stripe_account_id: invoice.snapshot.stripeAccountId,
      stripe_payment_intent_id: invoice.paymentIntentId,
      stripe_charge_id: invoice.chargeId,
      currency: invoice.snapshot.currency,
      exponent: currencyExponent(invoice.snapshot.currency),
      customer_charge_minor: allocation.customerCharge.amountMinor,
      project_amount_minor: allocation.projectAmount.amountMinor,
      platform_tip_minor: allocation.platformTip.amountMinor,
      oss_project_fee_minor: allocation.ossProjectFee.amountMinor,
      stripe_application_fee_minor: allocation.stripeApplicationFee.amountMinor,
      status: 'pending',
      cadence: invoice.snapshot.cadence,
      feature_mode: invoice.snapshot.featureMode,
      receipt_email: invoice.receiptEmail,
      public_show_name: invoice.snapshot.publicShowName,
      public_show_amount: invoice.snapshot.publicShowAmount,
      public_show_message: invoice.snapshot.publicShowMessage,
      public_display_name: invoice.snapshot.publicDisplayName,
      public_message: invoice.snapshot.publicMessage,
      settled_at: null,
    });
  }
  if (invoice.paymentIntentId || invoice.chargeId) {
    await deps.store.payments.updateProviderDetails?.(paymentId, {
      ...(invoice.paymentIntentId ? { stripe_payment_intent_id: invoice.paymentIntentId } : {}),
      ...(invoice.chargeId ? { stripe_charge_id: invoice.chargeId } : {}),
    });
  }
  const intent = buildMembershipSettlementIntent({
    stripeAccountId: invoice.snapshot.stripeAccountId,
    stripeEventId: invoice.invoiceId,
    paymentId,
    projectId: invoice.snapshot.projectId,
    currency: invoice.snapshot.currency,
    projectAmountMinor: invoice.snapshot.projectAmountMinor,
    platformTipMinor: invoice.snapshot.platformTipMinor,
    featureMode: invoice.snapshot.featureMode,
    cadence: invoice.snapshot.cadence,
  });
  const postingInput: MembershipLedgerPostingInput = {
    semanticKey: intent.semanticKey,
    stripeEventId: invoice.invoiceId,
    stripeAccountId: invoice.snapshot.stripeAccountId,
    paymentId,
    transferIds: [],
    metadata: {
      payment_id: paymentId,
      project_id: invoice.snapshot.projectId,
      currency: invoice.snapshot.currency,
      customer_charge_minor: allocation.customerCharge.amountMinor.toString(),
      project_amount_minor: allocation.projectAmount.amountMinor.toString(),
    },
  };

  const finalizeSettlement = async (
    store: MembershipStore,
    persistLedgerPosting: MembershipTransactionDeps['persistLedgerPosting'],
    enqueueEmailNotification?: MembershipTransactionDeps['enqueueEmailNotification'],
  ): Promise<boolean> => {
    const lockedSubscription = await store.findByIdForUpdate(subscription.id);
    if (!lockedSubscription)
      throw new Error('Membership subscription is missing during finalization');
    const currentPayment = await store.payments.findById(paymentId);
    const alreadySettled =
      (await hasSettledMembershipPayment(subscription.id, store)) ||
      (currentPayment !== undefined &&
        ['succeeded', 'refunded', 'disputed'].includes(currentPayment.status));
    const firstSettlement = !alreadySettled;
    if (persistLedgerPosting) await persistLedgerPosting(postingInput);
    const settled = await store.payments.markSettled(paymentId);
    if (!settled) throw new Error('Recurring payment is missing during ledger finalization');
    await store.setPeriodPayment(periodResult.period.id, paymentId);
    await onFinalized({
      paymentId,
      firstSettlement,
      store,
      ...(enqueueEmailNotification ? { enqueueEmailNotification } : {}),
    });
    return firstSettlement;
  };

  // The posting intent and membership state must commit before TigerBeetle sees
  // any transfer. A retry can replay the same deterministic intent if the
  // post-commit step is interrupted.
  if (deps.deferAfterCommit && deps.persistLedgerPosting) {
    await deps.persistLedgerPosting({ ...postingInput, status: 'pending' });
    deps.deferAfterCommit(async (postCommitDeps) => {
      const replay = await replayIntents(postCommitDeps.ledger, [intent]);
      const result = replay.results[0];
      if (!result?.ok) throw new Error(result?.error ?? 'membership ledger posting failed');
      const transit = accountId(
        AccountCode.PaymentTransit,
        'payment',
        paymentId,
        invoice.snapshot.currency,
      );
      if ((await postCommitDeps.ledger.getAccountBalance(transit)) !== 0n) {
        throw new Error('membership payment transit balance is not zero');
      }
      const postedInput: MembershipLedgerPostingInput = {
        ...postingInput,
        transferIds: result.transferIds,
        status: 'posted',
      };
      const finalize = async (transaction: MembershipTransactionDeps): Promise<void> => {
        if (!transaction.persistLedgerPosting) {
          throw new Error('Membership transaction cannot persist ledger posting');
        }
        await finalizeSettlement(
          transaction.store,
          () => transaction.persistLedgerPosting!(postedInput),
          transaction.enqueueEmailNotification,
        );
      };
      if (postCommitDeps.transaction) {
        await postCommitDeps.transaction(finalize);
      } else {
        if (!postCommitDeps.persistLedgerPosting) {
          throw new Error('Membership post-commit step cannot persist ledger posting');
        }
        await finalizeSettlement(postCommitDeps.store, () =>
          postCommitDeps.persistLedgerPosting!(postedInput),
        );
      }
    });
    return { paymentId, firstSettlement: !hadSettledPayment };
  }

  const replay = await replayIntents(deps.ledger, [intent]);
  const result = replay.results[0];
  if (!result?.ok) throw new Error(result?.error ?? 'membership ledger posting failed');
  const transit = accountId(
    AccountCode.PaymentTransit,
    'payment',
    paymentId,
    invoice.snapshot.currency,
  );
  if ((await deps.ledger.getAccountBalance(transit)) !== 0n) {
    throw new Error('membership payment transit balance is not zero');
  }
  const firstSettlement = await finalizeSettlement(
    deps.store,
    deps.persistLedgerPosting
      ? () =>
          deps.persistLedgerPosting!({
            ...postingInput,
            transferIds: result.transferIds,
            status: 'posted',
          })
      : undefined,
    deps.enqueueEmailNotification,
  );
  return { paymentId, firstSettlement };
}

async function hasSettledMembershipPayment(
  subscriptionId: string,
  store: MembershipStore,
): Promise<boolean> {
  const periods = await store.listPeriodsBySubscription(subscriptionId);
  for (const period of periods) {
    if (!period.payment_id) continue;
    const payment = await store.payments.findById(period.payment_id);
    if (payment && ['succeeded', 'refunded', 'disputed'].includes(payment.status)) return true;
  }
  return false;
}

async function grantInvoiceEntitlement(
  invoice: InvoiceDetails,
  subscription: Subscription,
  paymentId: string,
  store: MembershipStore,
): Promise<void> {
  if (!subscription.user_id) throw new Error('Membership supporter identity is missing');
  const tierRank = await store.findTierRank(invoice.snapshot.tierId);
  if (tierRank === undefined || !Number.isInteger(tierRank) || tierRank < 0) {
    throw new Error('Membership tier is missing or invalid');
  }
  const transitionKey = `membership:${subscription.stripe_subscription_id}:invoice:${invoice.invoiceId}`;
  await store.entitlements.createIfNew({
    id: uuidv7(),
    project_id: invoice.snapshot.projectId,
    user_id: subscription.user_id,
    tier_id: invoice.snapshot.tierId,
    payment_id: paymentId,
    subscription_id: subscription.id,
    kind: 'membership',
    tier_rank: tierRank,
    starts_at: invoice.period.start,
    ends_at: invoice.period.end,
    revoked_at: null,
    transition_key: transitionKey,
  });
}

function buildMembershipSettlementIntent(input: {
  stripeAccountId: string;
  stripeEventId: string;
  paymentId: string;
  projectId: string;
  currency: string;
  projectAmountMinor: bigint;
  platformTipMinor: bigint;
  featureMode: FeatureMode;
  cadence: Exclude<Cadence, 'one_off'>;
}) {
  const allocation = computeFeeAllocation(input);
  const currency = input.currency.toLowerCase();
  const ledger = ledgerForCurrency(currency);
  const clearing = accountId(
    AccountCode.StripeExternalClearing,
    'stripe_account',
    input.stripeAccountId,
    currency,
  );
  const transit = accountId(AccountCode.PaymentTransit, 'payment', input.paymentId, currency);
  const projectGross = accountId(
    AccountCode.ProjectGrossSupport,
    'project',
    input.projectId,
    currency,
  );
  const platformFee = accountId(
    AccountCode.PlatformProjectFeeRevenue,
    'platform',
    'oss.tips',
    currency,
  );
  const platformTip = accountId(
    AccountCode.PlatformSupporterTipRevenue,
    'platform',
    'oss.tips',
    currency,
  );
  const transfers: LedgerTransfer[] = [];
  const postingKind = 'membership_settlement';
  const push = (code: number, debitAccountId: bigint, creditAccountId: bigint, amount: bigint) => {
    if (amount <= 0n) return;
    const index = transfers.length;
    transfers.push({
      id: transferId(input.stripeAccountId, input.stripeEventId, postingKind, 1, index),
      debitAccountId,
      creditAccountId,
      amount,
      ledger,
      code,
      linked: true,
    });
  };
  push(
    TransferCode.SettledPaymentIntoTransit,
    clearing,
    transit,
    allocation.customerCharge.amountMinor,
  );
  push(
    TransferCode.TransitToProjectGross,
    transit,
    projectGross,
    allocation.projectBeforeStripe.amountMinor,
  );
  push(
    TransferCode.TransitToPlatformProjectFee,
    transit,
    platformFee,
    allocation.ossProjectFee.amountMinor,
  );
  push(
    TransferCode.TransitToPlatformSupporterTip,
    transit,
    platformTip,
    allocation.platformTip.amountMinor,
  );
  if (transfers.length === 0) throw new Error('membership payment produced no ledger transfers');
  transfers[transfers.length - 1]!.linked = false;
  return {
    postingKind,
    postingVersion: 1,
    semanticKey: `${input.stripeAccountId}:${input.stripeEventId}:${postingKind}:1`,
    currency,
    transfers,
    metadata: {
      stripeAccountId: input.stripeAccountId,
      stripeEventId: input.stripeEventId,
      paymentId: input.paymentId,
      projectId: input.projectId,
      featureMode: input.featureMode,
      projectAmountMinor: allocation.projectAmount.amountMinor,
      platformTipMinor: allocation.platformTip.amountMinor,
      customerChargeMinor: allocation.customerCharge.amountMinor,
      projectShareMinor: allocation.projectBeforeStripe.amountMinor,
      platformFeeMinor: allocation.ossProjectFee.amountMinor,
    },
  };
}

function collectMetadata(object: RecordValue): RecordValue {
  const sources: RecordValue[] = [];
  const parent = optionalRecord(object.parent);
  const subscriptionDetails = optionalRecord(parent?.subscription_details);
  const directSubscriptionDetails = optionalRecord(object.subscription_details);
  for (const value of [
    object.metadata,
    subscriptionDetails?.metadata,
    directSubscriptionDetails?.metadata,
  ]) {
    if (value !== undefined && value !== null) sources.push(record(value, 'Stripe metadata'));
  }
  const lines = optionalRecord(object.lines);
  const lineData = Array.isArray(lines?.data) ? lines.data : [];
  const firstLine = lineData.length > 0 ? optionalRecord(lineData[0]) : undefined;
  if (firstLine?.metadata !== undefined)
    sources.push(record(firstLine.metadata, 'Stripe line metadata'));
  const price = optionalRecord(firstLine?.price);
  if (price?.metadata !== undefined) sources.push(record(price.metadata, 'Stripe price metadata'));
  const merged: RecordValue = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== 'string') throw new Error(`Stripe metadata ${key} must be a string`);
      if (merged[key] !== undefined && merged[key] !== value) {
        throw new Error(`Conflicting Stripe metadata for ${key}`);
      }
      merged[key] = value;
    }
  }
  return merged;
}

function invoicePeriod(object: RecordValue): { start: Date; end: Date } {
  const directStart = optionalUnixDate(object.period_start);
  const directEnd = optionalUnixDate(object.period_end);
  if (directStart && directEnd) return validPeriod(directStart, directEnd);
  const lines = record(object.lines);
  const data = Array.isArray(lines?.data) ? lines.data : [];
  const period = data.length > 0 ? record(record(data[0]).period) : undefined;
  const start = optionalUnixDate(period?.start);
  const end = optionalUnixDate(period?.end);
  if (start && end) return validPeriod(start, end);
  throw new Error('Invoice is missing billing period');
}

function validPeriod(start: Date, end: Date): { start: Date; end: Date } {
  if (end <= start) throw new Error('Invoice billing period is invalid');
  return { start, end };
}

function validateProviderAmount(object: RecordValue, expected: bigint, paid: boolean): void {
  const keys = paid
    ? ['subtotal', 'amount_due', 'total', 'amount_paid']
    : ['subtotal', 'amount_due', 'total'];
  for (const key of keys) {
    if (object[key] === undefined || object[key] === null) continue;
    const actual = minor(object[key], `Invoice ${key}`);
    if (actual !== expected) throw new Error(`Invoice ${key} does not match membership amount`);
  }
}

function subscriptionIdFromObject(object: RecordValue): string | null {
  if (object.object === 'subscription') {
    return stringObjectId(object.id, 'Subscription id', 'sub_');
  }
  const direct = stringObjectId(object.subscription, 'Subscription id', 'sub_');
  if (direct) return direct;
  const parent = optionalRecord(object.parent);
  return stringObjectId(
    optionalRecord(parent?.subscription_details)?.subscription,
    'Subscription id',
    'sub_',
  );
}

function stringObjectId(value: unknown, name: string, prefix: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && value !== null && 'id' in value)
    value = (value as RecordValue).id;
  return identifier(value, name, prefix);
}

function identifier(value: unknown, name: string, prefix: string): string {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}[A-Za-z0-9_]+$`).test(value)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function metadataString(metadata: RecordValue, key: string): string | null {
  return optionalString(metadata[key]);
}

function metadataBoolean(metadata: RecordValue, key: string): boolean {
  const value = metadataString(metadata, key);
  if (value === null) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Membership metadata ${key} must be a boolean`);
}

function publicText(
  value: string | null,
  maxLength: number,
  label: string,
  rejectLinks = false,
): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    !/^[^\u0000-\u001f\u007f]+$/.test(normalized) ||
    (rejectLinks && /(?:https?|ftp|javascript|data):|www\./i.test(normalized))
  ) {
    throw new Error(`Membership public ${label} is invalid`);
  }
  return normalized;
}

function invoiceReceiptEmail(object: RecordValue): string | null {
  const customerDetails = optionalRecord(object.customer_details);
  const value = customerDetails?.email ?? object.customer_email ?? object.receipt_email;
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value.trim().toLowerCase();
}

function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function minor(value: unknown, name: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${name} is invalid`);
}

function optionalMinor(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  return minor(value, 'Invoice application fee');
}

function firstMinor(...values: unknown[]): bigint | null {
  for (const value of values)
    if (value !== undefined && value !== null) return minor(value, 'Invoice total');
  return null;
}

function metadataMinor(metadata: RecordValue, key: string): bigint | null {
  const value = metadata[key];
  return value === undefined || value === null || value === ''
    ? null
    : minor(value, `Membership metadata ${key}`);
}

function dbMinor(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  return minor(value, 'Stored membership amount');
}

function optionalUnixDate(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  const seconds = integer(value, 'Unix timestamp');
  return new Date(seconds * 1000);
}

function record(value: unknown, name = 'Value'): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${name} is invalid`);
  return value as RecordValue;
}

function optionalRecord(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}
