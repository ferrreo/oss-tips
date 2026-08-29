import type { FeatureMode } from '@oss-tips/domain';
import {
  AccountCode,
  accountId,
  buildOneOffSettlementIntent,
  replayIntents,
  transitBalance,
  type LedgerClient,
} from '@oss-tips/ledger';

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
};

export type SettleOneOffResult =
  | { ok: true; paymentId: string; transitBalance: bigint; semanticKey: string }
  | { ok: false; error: string; skipped?: boolean };

const SETTLEMENT_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
]);

export function shouldSettleOneOff(eventType: string): boolean {
  return SETTLEMENT_EVENT_TYPES.has(eventType);
}

function readMeta(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseMinor(value: string | null): bigint | null {
  if (value === null) return null;
  if (!/^-?\d+$/.test(value)) return null;
  return BigInt(value);
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
  const data = payload.data as { object?: Record<string, unknown> } | undefined;
  const object = data?.object;
  if (!object || typeof object !== 'object') {
    return { error: 'Stripe event missing data.object' };
  }

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
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

  const stripeAccountId =
    (typeof object.on_behalf_of === 'string' ? object.on_behalf_of : null) ??
    fallbackStripeAccountId ??
    (typeof payload.account === 'string' ? payload.account : null);

  if (!paymentId || !projectId || !currency || !featureMode) {
    return { error: 'Settlement metadata incomplete (payment_id/project_id/currency/feature_mode)' };
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

  const paymentIntent =
    typeof object.payment_intent === 'string'
      ? object.payment_intent
      : typeof object.id === 'string' && String(object.object) === 'payment_intent'
        ? object.id
        : null;

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
    stripePaymentIntentId: paymentIntent,
  };
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
    return { ok: false, error: `cadence ${args.metadata.cadence} not handled by one-off settler`, skipped: true };
  }

  const intent = buildOneOffSettlementIntent({
    stripeAccountId: args.metadata.stripeAccountId,
    stripeEventId: args.stripeEventId,
    paymentId: args.metadata.paymentId,
    projectId: args.metadata.projectId,
    currency: args.metadata.currency,
    projectAmountMinor: args.metadata.projectAmountMinor,
    platformTipMinor: args.metadata.platformTipMinor,
    featureMode: args.metadata.featureMode,
  });

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
  };
}
