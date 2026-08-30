import {
  computeFeeAllocation,
  oneOffEndsAt,
  proportionalPlatformRefund,
  type FeatureMode,
  type OneOffDuration,
} from '@oss-tips/domain';
import {
  AccountCode,
  accountId,
  buildDisputeIntent,
  buildOneOffRefundIntent,
  buildOneOffSettlementIntent,
  replayIntents,
  transitBalance,
  type LedgerClient,
} from '@oss-tips/ledger';
import { normalizeCurrency, validateIdentifier } from '@oss-tips/payments';

export type SettlementMetadata = {
  paymentId: string;
  projectId: string;
  stripeAccountId: string;
  currency: string;
  projectAmountMinor: bigint;
  platformTipMinor: bigint;
  featureMode: FeatureMode;
  cadence: string;
  customerChargeMinor: bigint;
  ossProjectFeeMinor: bigint;
  applicationFeeMinor: bigint;
  stripePaymentIntentId: string | null;
  stripeChargeId?: string;
  stripeApplicationFeeId?: string;
  paymentStatus?: string;
  receiptEmail?: string;
  publicOptions?: {
    showName: boolean;
    showAmount: boolean;
    showMessage: boolean;
    displayName?: string;
    message?: string;
  };
};

export type SettleOneOffResult =
  | {
      ok: true;
      paymentId: string;
      transitBalance: bigint;
      semanticKey: string;
      transferIds?: string[];
    }
  | { ok: false; error: string; skipped?: boolean };

export type RefundMetadata = SettlementMetadata & {
  stripeRefundId: string;
  refundAmountMinor: bigint;
};

export type DisputeMetadata = SettlementMetadata & {
  stripeDisputeId: string;
  disputeAmountMinor: bigint;
  disputeStatus: string;
};

export type LedgerCorrectionResult =
  | {
      ok: true;
      paymentId: string;
      semanticKey: string;
      applicationFeeRefundMinor?: bigint;
      transferIds?: string[];
    }
  | { ok: false; error: string };

export type OneOffEntitlementReconciliation = {
  grant: boolean;
  revoke: boolean;
  endsAt: Date | null;
};

/** Parse only durations supported by persisted tier configuration. */
export function parseOneOffDuration(value: string | null | undefined): OneOffDuration {
  if (value === null || value === undefined) return 'none';
  if (
    value === 'none' ||
    value === 'days_30' ||
    value === 'days_90' ||
    value === 'days_365' ||
    value === 'permanent'
  ) {
    return value;
  }
  if (value === 'year') return 'days_365';
  throw new Error('Tier one-off duration is invalid');
}

/** Recalculate access from the net settled amount after refunds/chargebacks. */
export function reconcileOneOffEntitlement(args: {
  duration: OneOffDuration;
  startsAt: Date;
  originalChargeMinor: bigint;
  refundedChargeMinor: bigint;
  disputedChargeMinor?: bigint;
}): OneOffEntitlementReconciliation {
  if (args.originalChargeMinor <= 0n) {
    throw new Error('Original charge must be positive for one-off entitlement');
  }
  if (args.refundedChargeMinor < 0n || (args.disputedChargeMinor ?? 0n) < 0n) {
    throw new Error('Reversed charge amounts must be non-negative');
  }
  if (args.duration === 'none') {
    return { grant: false, revoke: true, endsAt: args.startsAt };
  }
  const reversed = args.refundedChargeMinor + (args.disputedChargeMinor ?? 0n);
  const netSettled = args.originalChargeMinor > reversed ? args.originalChargeMinor - reversed : 0n;
  if (netSettled === 0n) return { grant: true, revoke: true, endsAt: args.startsAt };
  if (args.duration === 'permanent') return { grant: true, revoke: false, endsAt: null };

  const fullEnd = oneOffEndsAt(args.duration, args.startsAt);
  if (!fullEnd) throw new Error('Timed one-off duration did not produce an expiry');
  const durationMs = BigInt(fullEnd.getTime() - args.startsAt.getTime());
  const endMs =
    BigInt(args.startsAt.getTime()) + (durationMs * netSettled) / args.originalChargeMinor;
  const endsAt = new Date(Number(endMs));
  return {
    grant: true,
    revoke: endsAt.getTime() <= args.startsAt.getTime(),
    endsAt,
  };
}

const SETTLEMENT_EVENT_TYPES = new Set(['checkout.session.completed', 'payment_intent.succeeded']);

export function shouldSettleOneOff(eventType: string): boolean {
  return SETTLEMENT_EVENT_TYPES.has(eventType);
}

function readMeta(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBooleanMeta(metadata: Record<string, unknown> | undefined, key: string): boolean {
  const value = readMeta(metadata, key);
  return value === 'true';
}

function receiptEmail(object: Record<string, unknown>): string | undefined {
  const details = isRecord(object.customer_details) ? object.customer_details : undefined;
  const value = details?.email ?? object.receipt_email;
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value.trim().toLowerCase()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMinor(value: string | null): bigint | null {
  if (value === null) return null;
  if (!/^-?\d+$/.test(value)) return null;
  return BigInt(value);
}

function parseMinorValue(value: unknown): bigint | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  return typeof value === 'string' ? parseMinor(value) : null;
}

function eventObject(payload: Record<string, unknown>): Record<string, unknown> | null {
  const data = isRecord(payload.data) ? payload.data : null;
  return data && isRecord(data.object) ? data.object : null;
}

function objectMetadata(object: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(object.metadata) ? object.metadata : undefined;
}

function providerIdentifier(
  value: unknown,
  name: string,
  prefix: string,
): string | null | { error: string } {
  if (value === undefined || value === null) return null;
  const candidate =
    typeof value === 'string'
      ? value
      : isRecord(value) && typeof value.id === 'string'
        ? value.id
        : null;
  if (!candidate) return { error: `${name} is invalid` };
  try {
    return validateIdentifier(candidate, name, prefix);
  } catch {
    return { error: `${name} is invalid` };
  }
}

export type ProviderObjectDetails = {
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeApplicationFeeId: string | null;
};

/** Extract provider identities from a verified Stripe object. */
export function extractProviderObjectDetails(
  payload: Record<string, unknown>,
): ProviderObjectDetails | { error: string } {
  const object = eventObject(payload);
  if (!object) return { error: 'Stripe event missing data.object' };

  const objectId =
    typeof object.id === 'string' && typeof object.object === 'string' ? object.id : null;
  const paymentIntent = providerIdentifier(object.payment_intent, 'Payment intent id', 'pi_');
  if (paymentIntent !== null && typeof paymentIntent === 'object') return paymentIntent;
  const latestCharge = providerIdentifier(object.latest_charge, 'Charge id', 'ch_');
  if (latestCharge !== null && typeof latestCharge === 'object') return latestCharge;
  const charge = providerIdentifier(object.charge, 'Charge id', 'ch_');
  if (charge !== null && typeof charge === 'object') return charge;
  let stripePaymentIntentId: string | null = paymentIntent;
  if (!stripePaymentIntentId && object.object === 'payment_intent' && objectId) {
    stripePaymentIntentId = objectId;
  }
  if (stripePaymentIntentId) {
    try {
      validateIdentifier(stripePaymentIntentId, 'Payment intent id', 'pi_');
    } catch {
      return { error: 'Payment intent id is invalid' };
    }
  }

  let stripeChargeId: string | null = latestCharge ?? charge;
  if (!stripeChargeId && object.object === 'charge' && objectId) stripeChargeId = objectId;
  if (stripeChargeId) {
    try {
      validateIdentifier(stripeChargeId, 'Charge id', 'ch_');
    } catch {
      return { error: 'Charge id is invalid' };
    }
  }

  const metadataFeeId = readMeta(objectMetadata(object), 'application_fee_id');
  const feeValue = object.application_fee ?? metadataFeeId;
  const feeId = providerIdentifier(feeValue, 'Application fee id', 'fee_');
  if (feeId !== null && typeof feeId === 'object') return feeId;

  return {
    stripePaymentIntentId,
    stripeChargeId,
    stripeApplicationFeeId: feeId,
  };
}

export type RefundEntry = { stripeRefundId: string; refundAmountMinor: bigint };

/** Extract individual refund objects; never use charge.amount_refunded. */
export function extractRefundEntries(
  payload: Record<string, unknown>,
): RefundEntry[] | { error: string } {
  const object = eventObject(payload);
  if (!object) return { error: 'Stripe event missing data.object' };
  const entries: RefundEntry[] = [];
  const add = (id: unknown, amount: unknown): string | undefined => {
    if (typeof id !== 'string') return 'Refund id is invalid';
    let refundId: string;
    try {
      refundId = validateIdentifier(id, 'Refund id', 're_');
    } catch {
      return 'Refund id is invalid';
    }
    const parsed = parseMinorValue(amount);
    if (parsed === null || parsed <= 0n) return 'Refund amount is missing or invalid';
    entries.push({ stripeRefundId: refundId, refundAmountMinor: parsed });
    return undefined;
  };

  if (object.object === 'refund') {
    const error = add(object.id, object.amount);
    return error ? { error } : entries;
  }

  const refunds =
    isRecord(object.refunds) && Array.isArray(object.refunds.data)
      ? object.refunds.data.filter(isRecord)
      : [];
  for (const refund of refunds) {
    const error = add(refund.id, refund.amount);
    if (error) return { error };
  }
  const metadata = objectMetadata(object);
  if (entries.length === 0) {
    const metadataId = readMeta(metadata, 'refund_id');
    const metadataAmount = parseMinor(readMeta(metadata, 'refund_amount_minor'));
    if (metadataId && metadataAmount !== null) {
      const error = add(metadataId, metadataAmount);
      if (error) return { error };
    }
  }
  return entries;
}

function parseFeatureMode(value: string | null): FeatureMode | null {
  if (value === 'standard' || value === 'contributes_5_percent') return value;
  return null;
}

/**
 * Extract settlement fields from a Stripe event payload.
 * Expects Checkout Session or PaymentIntent object with our metadata.
 */
export function extractSettlementMetadata(
  payload: Record<string, unknown>,
  fallbackStripeAccountId: string | null,
): SettlementMetadata | { error: string } {
  const object = eventObject(payload);
  if (!object) {
    return { error: 'Stripe event missing data.object' };
  }

  const metadata = objectMetadata(object);
  const paymentId = readMeta(metadata, 'payment_id');
  const projectId = readMeta(metadata, 'project_id');
  const currency =
    readMeta(metadata, 'currency') ??
    (typeof object.currency === 'string' ? object.currency : null);
  const featureMode = parseFeatureMode(readMeta(metadata, 'feature_mode'));
  const projectAmountMinor = parseMinor(readMeta(metadata, 'project_amount_minor'));
  const platformTipMinor = parseMinor(readMeta(metadata, 'platform_tip_minor'));
  const customerChargeMinor = parseMinor(readMeta(metadata, 'customer_charge_minor'));
  const ossProjectFeeMinor = parseMinor(readMeta(metadata, 'oss_project_fee_minor'));
  const applicationFeeMinor = parseMinor(readMeta(metadata, 'application_fee_minor'));
  const cadence = readMeta(metadata, 'cadence') ?? 'one_off';
  const displayName = readMeta(metadata, 'display_name');
  const publicMessage = readMeta(metadata, 'public_message');
  if (displayName && (displayName.length > 120 || !/^[^\u0000-\u001f\u007f]+$/.test(displayName))) {
    return { error: 'Settlement public display name is invalid' };
  }
  if (
    publicMessage &&
    (publicMessage.length > 2000 || /(?:https?|ftp|javascript|data):|www\./i.test(publicMessage))
  ) {
    return { error: 'Settlement public message is invalid' };
  }

  const providerDetails = extractProviderObjectDetails(payload);
  if ('error' in providerDetails) return providerDetails;

  const stripeAccountId =
    fallbackStripeAccountId ??
    (typeof payload.account === 'string' ? payload.account : null) ??
    (typeof object.on_behalf_of === 'string' ? object.on_behalf_of : null);

  if (!paymentId || !projectId || !currency || !featureMode) {
    return {
      error: 'Settlement metadata incomplete (payment_id/project_id/currency/feature_mode)',
    };
  }
  if (
    projectAmountMinor === null ||
    platformTipMinor === null ||
    customerChargeMinor === null ||
    ossProjectFeeMinor === null ||
    applicationFeeMinor === null
  ) {
    return { error: 'Settlement metadata incomplete (amount fields)' };
  }
  if (!stripeAccountId) {
    return { error: 'Missing stripe account id on event' };
  }

  try {
    validateIdentifier(paymentId, 'Payment id');
    validateIdentifier(projectId, 'Project id');
    validateIdentifier(stripeAccountId, 'Stripe account id', 'acct_');
    normalizeCurrency(currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Settlement identity is invalid' };
  }
  if (cadence !== 'one_off' && cadence !== 'monthly' && cadence !== 'annual') {
    return { error: 'Settlement cadence is invalid' };
  }

  for (const [label, value] of [
    ['project_amount_minor', projectAmountMinor],
    ['platform_tip_minor', platformTipMinor],
    ['customer_charge_minor', customerChargeMinor],
    ['oss_project_fee_minor', ossProjectFeeMinor],
    ['application_fee_minor', applicationFeeMinor],
  ] as const) {
    if (value !== null && value < 0n) return { error: `${label} must be non-negative` };
  }

  // Refund and dispute objects carry their own amount; only compare payment
  // objects with the immutable charge amount to prevent metadata tampering.
  const objectKind = typeof object.object === 'string' ? object.object : '';
  if (objectKind !== 'refund' && objectKind !== 'dispute') {
    const providerAmount =
      parseMinorValue(object.amount_received) ??
      parseMinorValue(object.amount_total) ??
      parseMinorValue(object.amount);
    if (providerAmount !== null && providerAmount !== customerChargeMinor) {
      return { error: 'Stripe amount does not match settlement metadata' };
    }
  }

  const customerEmail = receiptEmail(object);
  return {
    paymentId,
    projectId,
    stripeAccountId,
    currency: currency.toLowerCase(),
    projectAmountMinor,
    platformTipMinor,
    featureMode,
    cadence,
    customerChargeMinor,
    ossProjectFeeMinor,
    applicationFeeMinor,
    stripePaymentIntentId: providerDetails.stripePaymentIntentId,
    ...(providerDetails.stripeChargeId ? { stripeChargeId: providerDetails.stripeChargeId } : {}),
    ...(providerDetails.stripeApplicationFeeId
      ? { stripeApplicationFeeId: providerDetails.stripeApplicationFeeId }
      : {}),
    ...(typeof object.payment_status === 'string' ? { paymentStatus: object.payment_status } : {}),
    ...(customerEmail ? { receiptEmail: customerEmail } : {}),
    publicOptions: {
      showName: readBooleanMeta(metadata, 'show_name'),
      showAmount: readBooleanMeta(metadata, 'show_amount'),
      showMessage: readBooleanMeta(metadata, 'show_message'),
      ...(displayName ? { displayName } : {}),
      ...(publicMessage ? { message: publicMessage } : {}),
    },
  };
}

/** Extract one refund amount, never cumulative charge.amount_refunded. */
export function extractRefundMetadata(
  payload: Record<string, unknown>,
  fallbackStripeAccountId: string | null,
  refundIdOverride?: string,
): RefundMetadata | { error: string } {
  const base = extractSettlementMetadata(payload, fallbackStripeAccountId);
  if ('error' in base) return base;
  const object = eventObject(payload);
  if (!object) return { error: 'Stripe event missing data.object' };
  const metadata = objectMetadata(object);
  let stripeRefundId = refundIdOverride ?? readMeta(metadata, 'refund_id');
  if (!stripeRefundId && object.object === 'refund' && typeof object.id === 'string') {
    stripeRefundId = object.id;
  }
  if (!stripeRefundId) {
    const entries = extractRefundEntries(payload);
    if ('error' in entries) return entries;
    if (entries.length === 1) stripeRefundId = entries[0]?.stripeRefundId ?? null;
  }
  if (!stripeRefundId) {
    return { error: 'Refund metadata missing refund_id; cumulative charge amount is unsafe' };
  }
  try {
    stripeRefundId = validateIdentifier(stripeRefundId, 'Refund id', 're_');
  } catch {
    return { error: 'Refund id is invalid' };
  }

  const refunds =
    isRecord(object.refunds) && Array.isArray(object.refunds.data)
      ? object.refunds.data.filter(isRecord)
      : [];
  const matchingRefund = refunds.find((refund) => refund.id === stripeRefundId);
  const providerAmount = parseMinorValue(
    object.object === 'refund' ? object.amount : matchingRefund?.amount,
  );
  const metadataAmount = parseMinor(readMeta(metadata, 'refund_amount_minor'));
  if (providerAmount !== null && metadataAmount !== null && providerAmount !== metadataAmount) {
    return { error: 'Refund amount does not match Stripe object' };
  }
  const amount = providerAmount ?? metadataAmount;
  if (amount === null || amount <= 0n) {
    return { error: 'Refund amount is missing or invalid' };
  }

  return { ...base, stripeRefundId, refundAmountMinor: amount };
}

/** Extract a dispute transition using the provider dispute amount, not a client amount. */
export function extractDisputeMetadata(
  payload: Record<string, unknown>,
  fallbackStripeAccountId: string | null,
  outcome?: 'opened' | 'won' | 'lost',
): DisputeMetadata | { error: string } {
  const base = extractSettlementMetadata(payload, fallbackStripeAccountId);
  if ('error' in base) return base;
  const object = eventObject(payload);
  if (!object) return { error: 'Stripe event missing data.object' };
  const metadata = objectMetadata(object);
  const stripeDisputeId =
    readMeta(metadata, 'dispute_id') ?? (typeof object.id === 'string' ? object.id : null);
  if (!stripeDisputeId) return { error: 'Dispute metadata missing dispute id' };
  try {
    validateIdentifier(stripeDisputeId, 'Dispute id', 'dp_');
  } catch {
    return { error: 'Dispute id is invalid' };
  }
  const providerAmount = parseMinorValue(object.amount);
  const metadataAmount = parseMinor(readMeta(metadata, 'dispute_amount_minor'));
  if (providerAmount !== null && metadataAmount !== null && providerAmount !== metadataAmount) {
    return { error: 'Dispute amount does not match Stripe object' };
  }
  const amount = providerAmount ?? metadataAmount;
  if (amount === null || amount <= 0n) return { error: 'Dispute amount is missing or invalid' };
  const disputeStatus =
    typeof object.status === 'string'
      ? object.status
      : outcome === 'opened' || outcome === undefined
        ? 'needs_response'
        : outcome;
  return { ...base, stripeDisputeId, disputeAmountMinor: amount, disputeStatus };
}

/**
 * Post one-off settlement transfers and require zero transit balance.
 */
export async function settleOneOffPayment(args: {
  ledger: LedgerClient;
  stripeEventId: string;
  metadata: SettlementMetadata;
}): Promise<SettleOneOffResult> {
  if (args.metadata.cadence !== 'one_off') {
    return {
      ok: false,
      error: `cadence ${args.metadata.cadence} not handled by one-off settler`,
      skipped: true,
    };
  }
  if (
    args.metadata.paymentStatus &&
    args.metadata.paymentStatus !== 'paid' &&
    args.metadata.paymentStatus !== 'no_payment_required'
  ) {
    return {
      ok: false,
      error: `payment status ${args.metadata.paymentStatus} is not settled`,
      skipped: true,
    };
  }

  let intent;
  try {
    intent = buildOneOffSettlementIntent({
      stripeAccountId: args.metadata.stripeAccountId,
      // checkout.session.completed and payment_intent.succeeded describe one
      // payment; use the stable internal payment id so thin events converge
      // even when one event omits the provider payment-intent identity.
      stripeEventId: args.metadata.paymentId,
      paymentId: args.metadata.paymentId,
      projectId: args.metadata.projectId,
      currency: args.metadata.currency,
      projectAmountMinor: args.metadata.projectAmountMinor,
      platformTipMinor: args.metadata.platformTipMinor,
      featureMode: args.metadata.featureMode,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (
    args.metadata.customerChargeMinor !== intent.metadata.customerChargeMinor ||
    args.metadata.ossProjectFeeMinor !== (intent.metadata.platformFeeMinor ?? 0n) ||
    args.metadata.applicationFeeMinor !==
      (intent.metadata.platformFeeMinor ?? 0n) + args.metadata.platformTipMinor
  ) {
    return { ok: false, error: 'Settlement metadata does not match server fee allocation' };
  }

  const summary = await replayIntents(args.ledger, [intent]);
  const result = summary.results[0];
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? 'ledger posting failed' };
  }

  const transit = accountId(
    AccountCode.PaymentTransit,
    'payment',
    args.metadata.paymentId,
    args.metadata.currency,
  );
  const balance = await args.ledger.getAccountBalance(transit);
  const fromTransfers = transitBalance(intent.transfers, transit);

  if (balance !== 0n || fromTransfers !== 0n) {
    return {
      ok: false,
      error: `transit balance not zero (ledger=${balance}, transfers=${fromTransfers})`,
    };
  }

  return {
    ok: true,
    paymentId: args.metadata.paymentId,
    transitBalance: balance,
    semanticKey: intent.semanticKey,
    transferIds: result.transferIds,
  };
}

function allocationForMetadata(metadata: SettlementMetadata) {
  const cadence =
    metadata.cadence === 'monthly' || metadata.cadence === 'annual' ? metadata.cadence : 'one_off';
  const allocation = computeFeeAllocation({
    projectAmountMinor: metadata.projectAmountMinor,
    platformTipMinor: metadata.platformTipMinor,
    currency: metadata.currency,
    featureMode: metadata.featureMode,
    cadence,
  });
  if (
    allocation.customerCharge.amountMinor !== metadata.customerChargeMinor ||
    allocation.ossProjectFee.amountMinor !== metadata.ossProjectFeeMinor ||
    allocation.stripeApplicationFee.amountMinor !== metadata.applicationFeeMinor
  ) {
    throw new Error('Settlement metadata does not match server fee allocation');
  }
  return allocation;
}

export async function postOneOffRefund(args: {
  ledger: LedgerClient;
  metadata: RefundMetadata;
}): Promise<LedgerCorrectionResult> {
  let allocation;
  try {
    allocation = allocationForMetadata(args.metadata);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  let intent;
  try {
    intent = buildOneOffRefundIntent({
      stripeAccountId: args.metadata.stripeAccountId,
      stripeEventId: args.metadata.stripeRefundId,
      paymentId: args.metadata.paymentId,
      projectId: args.metadata.projectId,
      currency: args.metadata.currency,
      refundCustomerChargeMinor: args.metadata.refundAmountMinor,
      originalCustomerChargeMinor: allocation.customerCharge.amountMinor,
      originalProjectAmountMinor: allocation.projectAmount.amountMinor,
      originalProjectShareMinor: allocation.projectBeforeStripe.amountMinor,
      originalPlatformFeeMinor: allocation.ossProjectFee.amountMinor,
      originalPlatformTipMinor: allocation.platformTip.amountMinor,
      featureMode: args.metadata.featureMode,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const summary = await replayIntents(args.ledger, [intent]);
  const result = summary.results[0];
  return result?.ok
    ? {
        ok: true,
        paymentId: args.metadata.paymentId,
        semanticKey: intent.semanticKey,
        transferIds: result.transferIds,
        applicationFeeRefundMinor: proportionalPlatformRefund({
          originalCustomerChargeMinor: allocation.customerCharge.amountMinor,
          refundCustomerChargeMinor: args.metadata.refundAmountMinor,
          originalApplicationFeeMinor: allocation.stripeApplicationFee.amountMinor,
        }),
      }
    : { ok: false, error: result?.error ?? 'refund ledger posting failed' };
}

export async function postDisputeTransition(args: {
  ledger: LedgerClient;
  metadata: DisputeMetadata;
  outcome: 'opened' | 'won' | 'lost';
}): Promise<LedgerCorrectionResult> {
  let allocation;
  try {
    allocation = allocationForMetadata(args.metadata);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (args.metadata.disputeAmountMinor > allocation.customerCharge.amountMinor) {
    return { ok: false, error: 'dispute amount exceeds original customer charge' };
  }
  let intent;
  try {
    intent = buildDisputeIntent({
      stripeAccountId: args.metadata.stripeAccountId,
      stripeEventId: args.metadata.stripeDisputeId,
      paymentId: args.metadata.paymentId,
      projectId: args.metadata.projectId,
      currency: args.metadata.currency,
      amountMinor: args.metadata.disputeAmountMinor,
      outcome: args.outcome,
      originalCustomerChargeMinor: allocation.customerCharge.amountMinor,
      originalProjectShareMinor: allocation.projectBeforeStripe.amountMinor,
      originalPlatformFeeMinor: allocation.ossProjectFee.amountMinor,
      originalPlatformTipMinor: allocation.platformTip.amountMinor,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const summary = await replayIntents(args.ledger, [intent]);
  const result = summary.results[0];
  return result?.ok
    ? {
        ok: true,
        paymentId: args.metadata.paymentId,
        semanticKey: intent.semanticKey,
        transferIds: result.transferIds,
      }
    : { ok: false, error: result?.error ?? 'dispute ledger posting failed' };
}
