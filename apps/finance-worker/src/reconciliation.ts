import {
  createJobsRepository,
  createReconciliationRepository,
  createStripeEventsRepository,
  dailyReconciliationJob,
  type Db,
  type JsonValue,
  type NewProviderBalanceTransaction,
  type ReconciliationDifference,
  type ReconciliationRun,
} from '@oss-tips/db';
import { AccountCode, accountId, TransferCode, type LedgerClient } from '@oss-tips/ledger';
import type {
  DurableInboxStore,
  StripeBalanceTransaction,
  StripeClient,
  StripeProviderEvent,
} from '@oss-tips/payments';
import {
  acceptStripeEventIntoInbox,
  normalizeCurrency,
  validateIdentifier,
} from '@oss-tips/payments';
import { proportionalPlatformRefund, uuidv7 } from '@oss-tips/domain';

const DAY_MS = 86_400_000;
const SETTLED_PAYMENT_STATUSES = ['succeeded', 'refunded', 'disputed'];
const RECONCILABLE_TYPES = new Set([
  'charge',
  'payment',
  'application_fee',
  'refund',
  'payment_refund',
  'payment_failure_refund',
  'application_fee_refund',
  'payment_reversal',
  'payment_unreconciled',
  'adjustment',
]);
const REFUND_TYPES = new Set(['refund', 'payment_refund', 'payment_failure_refund']);
const DISPUTE_TYPES = new Set(['payment_reversal', 'payment_unreconciled', 'adjustment']);
export const PLATFORM_RECONCILIATION_ACCOUNT_ID = 'platform';

export type ReconciliationClassification =
  'timing' | 'missing_event' | 'unknown_provider_object' | 'wrong_amount' | 'ledger_failure';

export type PaymentInput = {
  id: string;
  project_id: string;
  stripe_account_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_application_fee_id: string | null;
  stripe_application_fee_minor?: string | number | bigint;
  currency: string;
  customer_charge_minor: string | number | bigint;
  project_amount_minor: string | number | bigint;
  oss_project_fee_minor: string | number | bigint;
  status: string;
  settled_at: Date | null;
  created_at: Date;
};

export type RefundInput = {
  id: string;
  payment_id: string;
  stripe_refund_id: string;
  amount_minor: string | number | bigint;
  application_fee_refund_minor: string | number | bigint;
  stripe_application_fee_refund_id: string | null;
  currency: string;
  status: string;
  created_at: Date;
};

export type DisputeInput = {
  payment_id: string;
  stripe_dispute_id: string;
  amount_minor: string | number | bigint;
  currency: string;
  status: string;
  created_at: Date;
};

export type LedgerPostingInput = {
  payment_id: string | null;
  created_at?: Date;
  stripe_event_id?: string | null;
  posting_kind: string;
  intent_status: string;
  result_status: string | null;
  result_error: string | null;
  transfer_ids?: readonly string[];
};

export type LedgerTransferSnapshot = {
  id: string | bigint;
  amount: bigint | number;
  code: number;
  debitAccountId?: string | bigint;
  creditAccountId?: string | bigint;
};

export type LedgerTransferLookup = {
  missingIds: readonly string[];
  unexpectedIds: readonly string[];
  error: string | null;
};

export type ReconciliationComparisonInput = {
  providerTransactions: readonly StripeBalanceTransaction[];
  payments: readonly PaymentInput[];
  refunds: readonly RefundInput[];
  disputes: readonly DisputeInput[];
  ledgerPostings: readonly LedgerPostingInput[];
  ledgerTransfers?: readonly LedgerTransferSnapshot[];
  ledgerTransferLookup?: LedgerTransferLookup;
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
};

export type ReconciliationComparison = {
  differences: ReconciliationDifferenceInput[];
  providerNetMinor: bigint;
  ledgerNetMinor: bigint;
};

export type ReconciliationDifferenceInput = {
  classification: ReconciliationClassification;
  providerObjectId: string | null;
  expectedMinor: bigint | null;
  actualMinor: bigint | null;
  currency: string;
  details: JsonValue;
};

function minor(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  try {
    return BigInt(String(value));
  } catch {
    throw new Error('Stored reconciliation amount is invalid');
  }
}

function dayContains(value: Date | null | undefined, start: Date, end: Date): boolean {
  return value !== null && value !== undefined && value >= start && value < end;
}

function sourceId(transaction: StripeBalanceTransaction): string | null {
  return transaction.sourceId;
}

function providerMovement(transaction: StripeBalanceTransaction): bigint {
  // Add processing fees back: they are reported separately and are not an
  // oss.tips ledger deduction (docs/03 §7).
  return BigInt(transaction.netMinor) + BigInt(transaction.feeMinor);
}

function applicationFee(payment: PaymentInput): bigint {
  // Older normalized rows did not retain the fee amount, but the immutable
  // allocation still derives it exactly from the charge and project share.
  return payment.stripe_application_fee_minor === undefined
    ? minor(payment.customer_charge_minor) - ledgerNet(payment)
    : minor(payment.stripe_application_fee_minor);
}

function ledgerPosted(
  paymentId: string,
  postings: readonly LedgerPostingInput[],
  kind: 'settlement' | 'refund' | 'dispute',
  providerObjectId?: string,
): boolean {
  return postings.some(
    (posting) =>
      posting.payment_id === paymentId &&
      ((kind === 'settlement' && posting.posting_kind.endsWith('settlement')) ||
        (kind === 'refund' && posting.posting_kind === 'one_off_refund') ||
        (kind === 'dispute' && posting.posting_kind.startsWith('dispute_'))) &&
      (providerObjectId === undefined ||
        posting.stripe_event_id === undefined ||
        posting.stripe_event_id === null ||
        posting.stripe_event_id === providerObjectId) &&
      (posting.result_status === 'posted' || posting.result_status === 'succeeded'),
  );
}

function ledgerNet(payment: PaymentInput): bigint {
  // project_amount_minor is the selected project amount before the OSS fee;
  // ledger project gross is the post-fee share.
  return minor(payment.project_amount_minor) - minor(payment.oss_project_fee_minor);
}

function disputeProjectAmount(payment: PaymentInput, disputeAmount: bigint): bigint {
  const customerCharge = minor(payment.customer_charge_minor);
  const platformShare = customerCharge - ledgerNet(payment);
  const platformDispute = proportionalPlatformRefund({
    originalCustomerChargeMinor: customerCharge,
    refundCustomerChargeMinor: disputeAmount,
    originalApplicationFeeMinor: platformShare,
  });
  return disputeAmount - platformDispute;
}

function disputeProjectAmountForDifference(
  dispute: DisputeInput,
  paymentsById: ReadonlyMap<string, PaymentInput>,
): bigint {
  const amount = minor(dispute.amount_minor);
  const payment = paymentsById.get(dispute.payment_id);
  return payment ? disputeProjectAmount(payment, amount) : amount;
}

function jsonDetails(values: Record<string, string | number | null>): JsonValue {
  return values;
}

function addDifference(
  differences: ReconciliationDifferenceInput[],
  input: Omit<ReconciliationDifferenceInput, 'details'> & {
    details?: Record<string, string | number | null>;
  },
): void {
  differences.push({
    ...input,
    details: jsonDetails(input.details ?? {}),
  });
}

export async function lookupLedgerTransfers(
  ledger: Pick<LedgerClient, 'lookupTransfers'>,
  postings: readonly LedgerPostingInput[],
): Promise<{ transfers: LedgerTransferSnapshot[]; lookup: LedgerTransferLookup }> {
  const ids = [
    ...new Set(
      postings
        .filter(
          (posting) => posting.result_status === 'posted' || posting.result_status === 'succeeded',
        )
        .flatMap((posting) => posting.transfer_ids ?? [])
        .map(String),
    ),
  ];
  if (ids.length === 0) {
    return {
      transfers: [],
      lookup: { missingIds: [], unexpectedIds: [], error: null },
    };
  }

  let transferIds: bigint[];
  try {
    transferIds = ids.map((id) => BigInt(id));
  } catch {
    return {
      transfers: [],
      lookup: {
        missingIds: ids,
        unexpectedIds: [],
        error: 'Persisted TigerBeetle transfer ID is invalid',
      },
    };
  }

  let posted: Awaited<ReturnType<LedgerClient['lookupTransfers']>>;
  try {
    posted = await ledger.lookupTransfers(transferIds);
  } catch (error) {
    return {
      transfers: [],
      lookup: {
        missingIds: ids,
        unexpectedIds: [],
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const expected = new Set(ids);
  const seen = new Set<string>();
  const unexpectedIds: string[] = [];
  for (const transfer of posted) {
    const id = String(transfer.id);
    if (!expected.has(id) || seen.has(id)) unexpectedIds.push(id);
    else seen.add(id);
  }
  const missingIds = ids.filter((id) => !seen.has(id));
  return {
    transfers: posted.map((transfer) => ({
      id: transfer.id.toString(),
      amount: transfer.amount,
      code: transfer.code,
      debitAccountId: transfer.debitAccountId.toString(),
      creditAccountId: transfer.creditAccountId.toString(),
    })),
    lookup: { missingIds, unexpectedIds, error: null },
  };
}

function ledgerLookupIssueForPostings(
  postings: readonly LedgerPostingInput[],
  lookup: LedgerTransferLookup | undefined,
): LedgerTransferLookup | undefined {
  if (!lookup || postings.length === 0) return undefined;
  const missing = new Set(lookup.missingIds);
  const missingIds: string[] = [];
  for (const posting of postings) {
    const ids = posting.transfer_ids ?? [];
    if (ids.length === 0) missingIds.push('posting_without_transfer_ids');
    for (const id of ids.map(String)) {
      if (missing.has(id)) missingIds.push(id);
    }
  }
  const unexpectedIds = [...new Set(lookup.unexpectedIds)];
  if (!lookup.error && missingIds.length === 0 && unexpectedIds.length === 0) return undefined;
  return {
    missingIds: [...new Set(missingIds)],
    unexpectedIds: [...new Set(unexpectedIds)],
    error: lookup.error,
  };
}

function paymentForSource(
  source: string | null,
  paymentsByCharge: ReadonlyMap<string, PaymentInput>,
  paymentsByIntent: ReadonlyMap<string, PaymentInput>,
): PaymentInput | undefined {
  if (!source) return undefined;
  return paymentsByCharge.get(source) ?? paymentsByIntent.get(source);
}

/** Compare a fetched provider day with normalised payments/refunds and posting results. */
export function compareReconciliation(
  input: ReconciliationComparisonInput,
): ReconciliationComparison {
  if (input.periodStart >= input.periodEnd) throw new Error('Reconciliation period is invalid');
  const paymentsByCharge = new Map<string, PaymentInput>();
  const paymentsByIntent = new Map<string, PaymentInput>();
  const paymentsByFee = new Map<string, PaymentInput>();
  const paymentsById = new Map<string, PaymentInput>();
  for (const payment of input.payments) {
    paymentsById.set(payment.id, payment);
    if (payment.stripe_charge_id) paymentsByCharge.set(payment.stripe_charge_id, payment);
    if (payment.stripe_payment_intent_id) {
      paymentsByIntent.set(payment.stripe_payment_intent_id, payment);
    }
    if (payment.stripe_application_fee_id) {
      paymentsByFee.set(payment.stripe_application_fee_id, payment);
    }
  }
  const refundsById = new Map(input.refunds.map((refund) => [refund.stripe_refund_id, refund]));
  const feeRefundsById = new Map(
    input.refunds
      .filter((refund) => refund.stripe_application_fee_refund_id)
      .map((refund) => [refund.stripe_application_fee_refund_id as string, refund]),
  );
  const disputesById = new Map(
    input.disputes.map((dispute) => [dispute.stripe_dispute_id, dispute]),
  );
  const differences: ReconciliationDifferenceInput[] = [];
  const seenPaymentCharges = new Set<string>();
  const seenRefunds = new Set<string>();
  const seenDisputes = new Set<string>();
  let providerNetMinor = 0n;
  let expectedLedgerNetMinor = 0n;

  for (const transaction of input.providerTransactions) {
    if (!RECONCILABLE_TYPES.has(transaction.type)) continue;
    const objectId = sourceId(transaction);
    const currency = transaction.currency.toLowerCase();
    if (transaction.type === 'charge' || transaction.type === 'payment') {
      // Stripe processing fees are reporting-only in our ledger model. Add
      // them back before comparing provider balance movement to ledger net,
      // then remove the application fee withheld from the connected account.
      const payment = paymentForSource(objectId, paymentsByCharge, paymentsByIntent);
      providerNetMinor += providerMovement(transaction) - (payment ? applicationFee(payment) : 0n);
      if (!payment) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: {
            type: transaction.type,
            provider_net_minor: String(transaction.netMinor),
          },
        });
        continue;
      }
      if (payment.stripe_charge_id) seenPaymentCharges.add(payment.stripe_charge_id);
      const expected = minor(payment.customer_charge_minor);
      const actual = BigInt(transaction.amountMinor);
      const expectedLedger = ledgerNet(payment);
      expectedLedgerNetMinor += expectedLedger;
      if (actual !== expected) {
        addDifference(differences, {
          classification: 'wrong_amount',
          providerObjectId: objectId,
          expectedMinor: expected,
          actualMinor: actual,
          currency,
          details: {
            type: transaction.type,
            payment_id: payment.id,
            provider_net_minor: String(transaction.netMinor),
            ledger_net_minor: String(expectedLedger),
          },
        });
      }
      if (!ledgerPosted(payment.id, input.ledgerPostings, 'settlement')) {
        const posting = input.ledgerPostings.find((row) => row.payment_id === payment.id);
        addDifference(differences, {
          classification: 'ledger_failure',
          providerObjectId: objectId,
          expectedMinor: expectedLedger,
          actualMinor: null,
          currency,
          details: {
            payment_id: payment.id,
            provider_net_minor: String(transaction.netMinor),
            ledger_net_minor: '0',
            error: posting?.result_error ?? 'No successful ledger posting recorded',
          },
        });
      }
      continue;
    }

    if (transaction.type === 'application_fee') {
      // Direct-charge application-fee balance transactions are platform
      // scoped. Validate them here, but do not count them in connected-account
      // net (the charge movement already removes the fee).
      const payment = objectId ? paymentsByFee.get(objectId) : undefined;
      if (!payment) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: { type: transaction.type },
        });
        continue;
      }
      const intended = minor(payment.customer_charge_minor) - ledgerNet(payment);
      if (BigInt(transaction.amountMinor) !== intended) {
        addDifference(differences, {
          classification: 'wrong_amount',
          providerObjectId: objectId,
          expectedMinor: intended,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: { type: transaction.type, payment_id: payment.id },
        });
      }
      continue;
    }

    if (transaction.type === 'application_fee_refund') {
      // See application_fee above: refund movement is restored on its charge
      // refund, so this platform-scoped row is validation-only.
      const refund = objectId ? feeRefundsById.get(objectId) : undefined;
      if (!refund) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: { type: transaction.type },
        });
      } else {
        const expected = minor(refund.application_fee_refund_minor);
        const actual = BigInt(transaction.amountMinor);
        if (actual !== -expected) {
          addDifference(differences, {
            classification: 'wrong_amount',
            providerObjectId: objectId,
            expectedMinor: -expected,
            actualMinor: actual,
            currency,
            details: { type: transaction.type, refund_id: refund.id },
          });
        }
      }
      continue;
    }

    if (REFUND_TYPES.has(transaction.type)) {
      const refund = objectId ? refundsById.get(objectId) : undefined;
      if (!refund) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: { type: transaction.type, provider_net_minor: String(transaction.netMinor) },
        });
        continue;
      }
      seenRefunds.add(refund.stripe_refund_id);
      const expected = -minor(refund.amount_minor);
      // Stripe's connected-account refund removes the full customer refund;
      // restore the separately refunded application-fee share for the project
      // comparison. Platform fee refund transactions are platform-scoped and
      // therefore are validated above but not counted a second time here.
      providerNetMinor +=
        providerMovement(transaction) + minor(refund.application_fee_refund_minor);
      expectedLedgerNetMinor -=
        minor(refund.amount_minor) - minor(refund.application_fee_refund_minor);
      const actual = BigInt(transaction.amountMinor);
      if (actual !== expected) {
        addDifference(differences, {
          classification: 'wrong_amount',
          providerObjectId: objectId,
          expectedMinor: expected,
          actualMinor: actual,
          currency,
          details: { type: transaction.type, payment_id: refund.payment_id },
        });
      }
      if (
        !ledgerPosted(refund.payment_id, input.ledgerPostings, 'refund', refund.stripe_refund_id)
      ) {
        const posting = input.ledgerPostings.find(
          (row) => row.payment_id === refund.payment_id && row.posting_kind === 'one_off_refund',
        );
        addDifference(differences, {
          classification: 'ledger_failure',
          providerObjectId: objectId,
          expectedMinor: -(minor(refund.amount_minor) - minor(refund.application_fee_refund_minor)),
          actualMinor: null,
          currency,
          details: {
            refund_id: refund.id,
            ledger_net_minor: '0',
            error: posting?.result_error ?? 'No successful ledger posting recorded',
          },
        });
      }
      continue;
    }

    if (DISPUTE_TYPES.has(transaction.type) && objectId?.startsWith('dp_')) {
      const dispute = disputesById.get(objectId);
      if (!dispute) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: BigInt(transaction.amountMinor),
          currency,
          details: { type: transaction.type },
        });
      } else {
        seenDisputes.add(dispute.stripe_dispute_id);
        const payment = paymentsById.get(dispute.payment_id);
        const disputeAmount = minor(dispute.amount_minor);
        const projectDispute = payment
          ? disputeProjectAmount(payment, disputeAmount)
          : disputeAmount;
        const expected = dispute.status === 'won' ? disputeAmount : -disputeAmount;
        const actual = BigInt(transaction.amountMinor);
        const platformDispute = disputeAmount - projectDispute;
        const sign = dispute.status === 'won' ? 1n : -1n;
        // Dispute balance movement is for the full customer amount. Remove
        // platform's proportional share so provider and project ledger use
        // the same project allocation.
        providerNetMinor += providerMovement(transaction) - sign * platformDispute;
        if (actual !== expected) {
          addDifference(differences, {
            classification: 'wrong_amount',
            providerObjectId: objectId,
            expectedMinor: expected,
            actualMinor: actual,
            currency,
            details: {
              type: transaction.type,
              payment_id: dispute.payment_id,
              ledger_net_minor: String(dispute.status === 'won' ? projectDispute : -projectDispute),
            },
          });
        }
        if (
          !ledgerPosted(
            dispute.payment_id,
            input.ledgerPostings,
            'dispute',
            dispute.stripe_dispute_id,
          )
        ) {
          const posting = input.ledgerPostings.find(
            (row) =>
              row.payment_id === dispute.payment_id && row.posting_kind.startsWith('dispute_'),
          );
          addDifference(differences, {
            classification: 'ledger_failure',
            providerObjectId: objectId,
            expectedMinor: dispute.status === 'won' ? projectDispute : -projectDispute,
            actualMinor: null,
            currency,
            details: {
              dispute_id: dispute.stripe_dispute_id,
              ledger_net_minor: '0',
              error: posting?.result_error ?? 'No successful ledger posting recorded',
            },
          });
        }
        if (dispute.status !== 'won') expectedLedgerNetMinor -= projectDispute;
        else expectedLedgerNetMinor += projectDispute;
      }
    }
  }

  const timing = (value: Date | null): boolean =>
    value !== null && input.now !== undefined && input.now.getTime() - value.getTime() < 2 * DAY_MS;
  for (const payment of input.payments) {
    if (!SETTLED_PAYMENT_STATUSES.includes(payment.status)) continue;
    if (
      !dayContains(payment.settled_at ?? payment.created_at, input.periodStart, input.periodEnd)
    ) {
      continue;
    }
    if (payment.stripe_charge_id && !seenPaymentCharges.has(payment.stripe_charge_id)) {
      const expected = minor(payment.customer_charge_minor);
      addDifference(differences, {
        classification: timing(payment.settled_at) ? 'timing' : 'missing_event',
        providerObjectId: payment.stripe_charge_id,
        expectedMinor: expected,
        actualMinor: null,
        currency: payment.currency.toLowerCase(),
        details: {
          payment_id: payment.id,
          ledger_net_minor: String(ledgerNet(payment)),
          recovery_object_id: payment.stripe_charge_id,
          recovery_locator: 'data.object.id',
        },
      });
    }
  }
  for (const refund of input.refunds) {
    if (refund.status !== 'succeeded' || seenRefunds.has(refund.stripe_refund_id)) continue;
    if (!dayContains(refund.created_at, input.periodStart, input.periodEnd)) continue;
    addDifference(differences, {
      classification: timing(refund.created_at) ? 'timing' : 'missing_event',
      providerObjectId: refund.stripe_refund_id,
      expectedMinor: -minor(refund.amount_minor),
      actualMinor: null,
      currency: refund.currency.toLowerCase(),
      details: {
        payment_id: refund.payment_id,
        recovery_object_id: refund.stripe_refund_id,
        recovery_locator: 'data.object.refunds.data[].id',
      },
    });
  }
  for (const dispute of input.disputes) {
    if (seenDisputes.has(dispute.stripe_dispute_id)) continue;
    if (!dayContains(dispute.created_at, input.periodStart, input.periodEnd)) continue;
    addDifference(differences, {
      classification: timing(dispute.created_at) ? 'timing' : 'missing_event',
      providerObjectId: dispute.stripe_dispute_id,
      expectedMinor:
        dispute.status === 'won' ? minor(dispute.amount_minor) : -minor(dispute.amount_minor),
      actualMinor: null,
      currency: dispute.currency.toLowerCase(),
      details: {
        payment_id: dispute.payment_id,
        ledger_net_minor: String(
          dispute.status === 'won'
            ? disputeProjectAmountForDifference(dispute, paymentsById)
            : -disputeProjectAmountForDifference(dispute, paymentsById),
        ),
        recovery_object_id: dispute.stripe_dispute_id,
        recovery_locator: 'data.object.id',
      },
    });
  }

  let ledgerNetMinor = expectedLedgerNetMinor;
  const transfersById = new Map(
    (input.ledgerTransfers ?? []).map((transfer) => [String(transfer.id), transfer]),
  );
  const currentPaymentIds = new Set(input.payments.map((payment) => payment.id));
  const currentRefundIds = new Set(input.refunds.map((refund) => refund.stripe_refund_id));
  const currentDisputeIds = new Set(input.disputes.map((dispute) => dispute.stripe_dispute_id));
  const currentPostings = input.ledgerPostings.filter((posting) => {
    if (posting.payment_id === null || !currentPaymentIds.has(posting.payment_id)) return false;
    if (posting.posting_kind.endsWith('settlement')) return true;
    if (posting.posting_kind === 'one_off_refund') {
      return (
        (posting.stripe_event_id !== undefined &&
          posting.stripe_event_id !== null &&
          currentRefundIds.has(posting.stripe_event_id)) ||
        (posting.stripe_event_id === undefined &&
          posting.created_at !== undefined &&
          dayContains(posting.created_at, input.periodStart, input.periodEnd))
      );
    }
    if (posting.posting_kind.startsWith('dispute_')) {
      return (
        (posting.stripe_event_id !== undefined &&
          posting.stripe_event_id !== null &&
          currentDisputeIds.has(posting.stripe_event_id)) ||
        (posting.stripe_event_id === undefined &&
          posting.created_at !== undefined &&
          dayContains(posting.created_at, input.periodStart, input.periodEnd))
      );
    }
    return false;
  });
  const successfulPostings = currentPostings.filter(
    (posting) => posting.result_status === 'posted' || posting.result_status === 'succeeded',
  );
  const ledgerLookupFailure = ledgerLookupIssueForPostings(
    successfulPostings,
    input.ledgerTransferLookup,
  );
  if (ledgerLookupFailure) {
    addDifference(differences, {
      classification: 'ledger_failure',
      providerObjectId: null,
      expectedMinor: null,
      actualMinor: null,
      currency: input.providerTransactions[0]?.currency?.toLowerCase() ?? 'gbp',
      details: {
        reason: 'Durable TigerBeetle transfer lookup incomplete',
        missing_transfer_ids: ledgerLookupFailure.missingIds.join(','),
        unexpected_transfer_ids: ledgerLookupFailure.unexpectedIds.join(','),
        error: ledgerLookupFailure.error,
      },
    });
  }
  const snapshotCoversPostings =
    (input.ledgerTransfers?.length ?? 0) > 0 &&
    successfulPostings.length > 0 &&
    successfulPostings.every(
      (posting) =>
        (posting.transfer_ids ?? []).length > 0 &&
        (posting.transfer_ids ?? []).every((id) => transfersById.has(String(id))),
    );
  if (snapshotCoversPostings) {
    let snapshotLedgerNet = 0n;
    for (const posting of successfulPostings) {
      for (const id of posting.transfer_ids ?? []) {
        const transfer = transfersById.get(String(id));
        if (!transfer) continue;
        const amount = BigInt(transfer.amount);
        if (
          transfer.code === TransferCode.TransitToProjectGross ||
          transfer.code === TransferCode.DisputeWonReversal
        ) {
          snapshotLedgerNet += amount;
        }
        if (
          transfer.code === TransferCode.ProjectRefund ||
          transfer.code === TransferCode.DisputeOpened
        ) {
          snapshotLedgerNet -= amount;
        }
      }
    }
    ledgerNetMinor = snapshotLedgerNet;
  }
  if (ledgerLookupFailure) ledgerNetMinor = 0n;
  if (differences.length === 0 && providerNetMinor !== ledgerNetMinor) {
    addDifference(differences, {
      classification: 'wrong_amount',
      providerObjectId: null,
      expectedMinor: ledgerNetMinor,
      actualMinor: providerNetMinor,
      currency: input.providerTransactions[0]?.currency?.toLowerCase() ?? 'gbp',
      details: {
        provider_net_minor: String(providerNetMinor),
        ledger_net_minor: String(ledgerNetMinor),
        reason: 'Aggregate provider and ledger net differ',
      },
    });
  }
  return { differences, providerNetMinor, ledgerNetMinor };
}

function providerEventObjectIds(event: StripeProviderEvent): Set<string> {
  const ids = new Set<string>();
  if (event.objectId) ids.add(event.objectId);
  const data = event.payload.data;
  if (typeof data !== 'object' || data === null || !('object' in data)) return ids;
  const object = data.object;
  if (typeof object !== 'object' || object === null) return ids;
  if ('id' in object && typeof object.id === 'string') ids.add(object.id);
  if (!('refunds' in object) || typeof object.refunds !== 'object' || object.refunds === null) {
    return ids;
  }
  const refunds = object.refunds;
  if (!('data' in refunds) || !Array.isArray(refunds.data)) return ids;
  for (const refund of refunds.data) {
    if (
      typeof refund === 'object' &&
      refund !== null &&
      'id' in refund &&
      typeof refund.id === 'string'
    ) {
      ids.add(refund.id);
    }
  }
  return ids;
}

/** Retrieve stale provider objects and place their raw events in the durable inbox. */
export async function recoverMissingStripeEvents(args: {
  stripe: Pick<StripeClient, 'listEvents'>;
  store: DurableInboxStore;
  stripeAccountId: string | null;
  periodStart: Date;
  periodEnd: Date;
  differences: readonly Pick<
    ReconciliationDifferenceInput,
    'classification' | 'providerObjectId'
  >[];
}): Promise<{ recovered: number; notFound: number }> {
  const objectIds = [
    ...new Set(
      args.differences
        .filter(
          (difference) =>
            difference.classification === 'missing_event' && difference.providerObjectId !== null,
        )
        .map((difference) => difference.providerObjectId as string),
    ),
  ];
  if (objectIds.length === 0) return { recovered: 0, notFound: 0 };
  if (!args.stripe.listEvents) return { recovered: 0, notFound: objectIds.length };

  const events = await args.stripe.listEvents({
    stripeAccountId: args.stripeAccountId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const eventsByObjectId = new Map<string, StripeProviderEvent[]>();
  for (const event of events) {
    for (const objectId of providerEventObjectIds(event)) {
      const matching = eventsByObjectId.get(objectId) ?? [];
      matching.push(event);
      eventsByObjectId.set(objectId, matching);
    }
  }

  let recovered = 0;
  const seenEventIds = new Set<string>();
  let notFound = 0;
  for (const objectId of objectIds) {
    const matching = eventsByObjectId.get(objectId);
    if (!matching || matching.length === 0) {
      notFound += 1;
      continue;
    }
    for (const event of matching) {
      if (seenEventIds.has(event.id)) continue;
      const account =
        event.stripeAccountId === PLATFORM_RECONCILIATION_ACCOUNT_ID
          ? null
          : (event.stripeAccountId ?? args.stripeAccountId);
      const accepted = await acceptStripeEventIntoInbox({
        event: {
          id: event.id,
          type: event.type,
          apiVersion: event.apiVersion,
          account,
          payload: event.payload,
          createdAt: Math.floor(event.createdAt.getTime() / 1_000),
          objectId,
        },
        store: args.store,
        rawBodyByteLength: Buffer.byteLength(JSON.stringify(event.payload)),
        expectedStripeAccountId: account ?? undefined,
      });
      seenEventIds.add(event.id);
      if (accepted.kind === 'accepted' && accepted.created) recovered += 1;
    }
  }
  return { recovered, notFound };
}

function createDurableInboxStore(db: Db): DurableInboxStore {
  const repository = createStripeEventsRepository(db);
  return {
    async insertIfNew(row) {
      const inserted = await repository.insertIfNew({
        id: row.id,
        stripe_event_id: row.stripe_event_id,
        stripe_account_id: row.stripe_account_id,
        event_type: row.event_type,
        api_version: row.api_version,
        payload: row.payload as JsonValue,
        processed_at: null,
        process_error: null,
      });
      if (!inserted) throw new Error('Failed to persist recovered stripe event');
      return {
        created: inserted.created,
        stripeEventId: inserted.event.stripe_event_id,
      };
    },
  };
}

export type PlatformReconciliationComparisonInput = {
  providerTransactions: readonly StripeBalanceTransaction[];
  payments: readonly PaymentInput[];
  refunds: readonly RefundInput[];
  ledgerPostings: readonly LedgerPostingInput[];
  ledgerTransfers?: readonly LedgerTransferSnapshot[];
  ledgerTransferLookup?: LedgerTransferLookup;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
};

/** Compare platform application-fee movements with platform ledger revenue accounts. */
export function comparePlatformReconciliation(
  input: PlatformReconciliationComparisonInput,
): ReconciliationComparison {
  if (input.periodStart >= input.periodEnd) throw new Error('Reconciliation period is invalid');
  const currency = normalizeCurrency(input.currency);
  const paymentsByFee = new Map(
    input.payments
      .filter((payment) => payment.stripe_application_fee_id)
      .map((payment) => [payment.stripe_application_fee_id as string, payment]),
  );
  const feeRefundsById = new Map(
    input.refunds
      .filter((refund) => refund.stripe_application_fee_refund_id)
      .map((refund) => [refund.stripe_application_fee_refund_id as string, refund]),
  );
  const differences: ReconciliationDifferenceInput[] = [];
  const seenFees = new Set<string>();
  const seenFeeRefunds = new Set<string>();
  let providerNetMinor = 0n;
  let expectedLedgerNetMinor = 0n;

  for (const transaction of input.providerTransactions) {
    if (transaction.type !== 'application_fee' && transaction.type !== 'application_fee_refund') {
      continue;
    }
    const objectId = sourceId(transaction);
    const actual = BigInt(transaction.amountMinor);
    providerNetMinor += providerMovement(transaction);
    if (transaction.type === 'application_fee') {
      const payment = objectId ? paymentsByFee.get(objectId) : undefined;
      if (!payment) {
        addDifference(differences, {
          classification: 'unknown_provider_object',
          providerObjectId: objectId,
          expectedMinor: null,
          actualMinor: actual,
          currency,
          details: { type: transaction.type },
        });
        continue;
      }
      seenFees.add(payment.stripe_application_fee_id as string);
      const expected = applicationFee(payment);
      expectedLedgerNetMinor += expected;
      if (actual !== expected) {
        addDifference(differences, {
          classification: 'wrong_amount',
          providerObjectId: objectId,
          expectedMinor: expected,
          actualMinor: actual,
          currency,
          details: { type: transaction.type, payment_id: payment.id },
        });
      }
      if (!ledgerPosted(payment.id, input.ledgerPostings, 'settlement')) {
        const posting = input.ledgerPostings.find((row) => row.payment_id === payment.id);
        addDifference(differences, {
          classification: 'ledger_failure',
          providerObjectId: objectId,
          expectedMinor: expected,
          actualMinor: null,
          currency,
          details: {
            payment_id: payment.id,
            error: posting?.result_error ?? 'No successful ledger posting recorded',
          },
        });
      }
      continue;
    }

    const refund = objectId ? feeRefundsById.get(objectId) : undefined;
    if (!refund) {
      addDifference(differences, {
        classification: 'unknown_provider_object',
        providerObjectId: objectId,
        expectedMinor: null,
        actualMinor: actual,
        currency,
        details: { type: transaction.type },
      });
      continue;
    }
    seenFeeRefunds.add(refund.stripe_application_fee_refund_id as string);
    const expectedFeeRefund = minor(refund.application_fee_refund_minor);
    const expected = -expectedFeeRefund;
    expectedLedgerNetMinor -= expectedFeeRefund;
    if (actual !== expected) {
      addDifference(differences, {
        classification: 'wrong_amount',
        providerObjectId: objectId,
        expectedMinor: expected,
        actualMinor: actual,
        currency,
        details: { type: transaction.type, refund_id: refund.id },
      });
    }
    if (!ledgerPosted(refund.payment_id, input.ledgerPostings, 'refund', refund.stripe_refund_id)) {
      const posting = input.ledgerPostings.find(
        (row) => row.payment_id === refund.payment_id && row.posting_kind === 'one_off_refund',
      );
      addDifference(differences, {
        classification: 'ledger_failure',
        providerObjectId: objectId,
        expectedMinor: expected,
        actualMinor: null,
        currency,
        details: {
          refund_id: refund.id,
          error: posting?.result_error ?? 'No successful ledger posting recorded',
        },
      });
    }
  }

  const timing = (value: Date | null): boolean =>
    value !== null && input.now !== undefined && input.now.getTime() - value.getTime() < 2 * DAY_MS;
  for (const payment of input.payments) {
    if (!SETTLED_PAYMENT_STATUSES.includes(payment.status)) continue;
    if (
      !dayContains(payment.settled_at ?? payment.created_at, input.periodStart, input.periodEnd)
    ) {
      continue;
    }
    const feeId = payment.stripe_application_fee_id;
    if (!feeId || seenFees.has(feeId)) continue;
    const expected = applicationFee(payment);
    expectedLedgerNetMinor += expected;
    addDifference(differences, {
      classification: timing(payment.settled_at) ? 'timing' : 'missing_event',
      providerObjectId: feeId,
      expectedMinor: expected,
      actualMinor: null,
      currency,
      details: {
        payment_id: payment.id,
        recovery_object_id: feeId,
        recovery_locator: 'data.object.id',
      },
    });
  }
  for (const refund of input.refunds) {
    const feeRefundId = refund.stripe_application_fee_refund_id;
    if (refund.status !== 'succeeded' || !feeRefundId || seenFeeRefunds.has(feeRefundId)) continue;
    if (!dayContains(refund.created_at, input.periodStart, input.periodEnd)) continue;
    const expected = -minor(refund.application_fee_refund_minor);
    expectedLedgerNetMinor += expected;
    addDifference(differences, {
      classification: timing(refund.created_at) ? 'timing' : 'missing_event',
      providerObjectId: feeRefundId,
      expectedMinor: expected,
      actualMinor: null,
      currency,
      details: {
        refund_id: refund.id,
        recovery_object_id: feeRefundId,
        recovery_locator: 'data.object.id',
      },
    });
  }

  let ledgerNetMinor = expectedLedgerNetMinor;
  const transfersById = new Map(
    (input.ledgerTransfers ?? []).map((transfer) => [String(transfer.id), transfer]),
  );
  const currentPostings = input.ledgerPostings.filter(
    (posting) =>
      (posting.created_at === undefined ||
        dayContains(posting.created_at, input.periodStart, input.periodEnd)) &&
      posting.payment_id !== null &&
      (posting.result_status === 'posted' || posting.result_status === 'succeeded'),
  );
  const ledgerLookupFailure = ledgerLookupIssueForPostings(
    currentPostings,
    input.ledgerTransferLookup,
  );
  if (ledgerLookupFailure) {
    addDifference(differences, {
      classification: 'ledger_failure',
      providerObjectId: null,
      expectedMinor: null,
      actualMinor: null,
      currency,
      details: {
        reason: 'Durable TigerBeetle transfer lookup incomplete',
        missing_transfer_ids: ledgerLookupFailure.missingIds.join(','),
        unexpected_transfer_ids: ledgerLookupFailure.unexpectedIds.join(','),
        error: ledgerLookupFailure.error,
      },
    });
  }
  const snapshotCoversPostings =
    (input.ledgerTransfers?.length ?? 0) > 0 &&
    currentPostings.length > 0 &&
    currentPostings.every(
      (posting) =>
        (posting.transfer_ids ?? []).length > 0 &&
        (posting.transfer_ids ?? []).every((id) => transfersById.has(String(id))),
    );
  if (snapshotCoversPostings) {
    const platformAccounts = new Set([
      accountId(AccountCode.PlatformProjectFeeRevenue, 'platform', 'oss.tips', currency).toString(),
      accountId(
        AccountCode.PlatformSupporterTipRevenue,
        'platform',
        'oss.tips',
        currency,
      ).toString(),
    ]);
    let snapshotLedgerNet = 0n;
    for (const posting of currentPostings) {
      for (const id of posting.transfer_ids ?? []) {
        const transfer = transfersById.get(String(id));
        if (!transfer) continue;
        const amount = BigInt(transfer.amount);
        if (transfer.creditAccountId !== undefined && transfer.debitAccountId !== undefined) {
          if (platformAccounts.has(String(transfer.creditAccountId))) snapshotLedgerNet += amount;
          if (platformAccounts.has(String(transfer.debitAccountId))) snapshotLedgerNet -= amount;
        } else if (
          transfer.code === TransferCode.TransitToPlatformProjectFee ||
          transfer.code === TransferCode.TransitToPlatformSupporterTip ||
          transfer.code === TransferCode.DisputeWonReversal
        ) {
          snapshotLedgerNet += amount;
        } else if (
          transfer.code === TransferCode.ApplicationFeeRefund ||
          transfer.code === TransferCode.DisputeOpened
        ) {
          snapshotLedgerNet -= amount;
        }
      }
    }
    ledgerNetMinor = snapshotLedgerNet;
  }
  if (ledgerLookupFailure) ledgerNetMinor = 0n;
  if (differences.length === 0 && providerNetMinor !== ledgerNetMinor) {
    addDifference(differences, {
      classification: 'wrong_amount',
      providerObjectId: null,
      expectedMinor: ledgerNetMinor,
      actualMinor: providerNetMinor,
      currency,
      details: {
        provider_net_minor: String(providerNetMinor),
        ledger_net_minor: String(ledgerNetMinor),
        reason: 'Aggregate platform provider and ledger net differ',
      },
    });
  }
  return { differences, providerNetMinor, ledgerNetMinor };
}

function parseDate(value: string, name: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error(`${name} is invalid`);
  }
  return date;
}

function providerRow(transaction: StripeBalanceTransaction): NewProviderBalanceTransaction {
  return {
    id: uuidv7(),
    stripe_account_id: transaction.stripeAccountId,
    stripe_balance_transaction_id: transaction.id,
    currency: transaction.currency.toLowerCase(),
    amount_minor: transaction.amountMinor,
    fee_minor: transaction.feeMinor,
    net_minor: transaction.netMinor,
    type: transaction.type,
    source_id: transaction.sourceId,
    available_on: transaction.availableOn,
    raw: {
      id: transaction.id,
      currency: transaction.currency.toLowerCase(),
      amount_minor: transaction.amountMinor,
      fee_minor: transaction.feeMinor,
      net_minor: transaction.netMinor,
      type: transaction.type,
      source_id: transaction.sourceId,
      created_at: transaction.createdAt.toISOString(),
      available_on: transaction.availableOn?.toISOString() ?? null,
    },
  };
}

async function readInputs(
  db: Db,
  window: { stripeAccountId: string; currency: string; periodStart: Date; periodEnd: Date },
): Promise<{
  payments: PaymentInput[];
  refunds: RefundInput[];
  disputes: DisputeInput[];
  ledgerPostings: LedgerPostingInput[];
}> {
  const payments = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'stripe_account_id',
      'stripe_payment_intent_id',
      'stripe_charge_id',
      'stripe_application_fee_id',
      'stripe_application_fee_minor',
      'currency',
      'customer_charge_minor',
      'project_amount_minor',
      'oss_project_fee_minor',
      'status',
      'settled_at',
      'created_at',
    ])
    .where('stripe_account_id', '=', window.stripeAccountId)
    .where('currency', '=', window.currency)
    .where('status', 'in', SETTLED_PAYMENT_STATUSES)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('settled_at', '>=', window.periodStart),
          eb('settled_at', '<', window.periodEnd),
        ]),
        eb.and([
          eb('created_at', '>=', window.periodStart),
          eb('created_at', '<', window.periodEnd),
        ]),
      ]),
    )
    .execute();
  const refunds = await db
    .selectFrom('refund')
    .innerJoin('payment', 'payment.id', 'refund.payment_id')
    .select([
      'refund.id',
      'refund.payment_id',
      'refund.stripe_refund_id',
      'refund.amount_minor',
      'refund.application_fee_refund_minor',
      'refund.stripe_application_fee_refund_id',
      'refund.currency',
      'refund.status',
      'refund.created_at',
    ])
    .where('payment.stripe_account_id', '=', window.stripeAccountId)
    .where('refund.currency', '=', window.currency)
    .where('refund.created_at', '>=', window.periodStart)
    .where('refund.created_at', '<', window.periodEnd)
    .execute();
  const disputes = await db
    .selectFrom('payment_dispute')
    .innerJoin('payment', 'payment.id', 'payment_dispute.payment_id')
    .select([
      'payment_dispute.payment_id',
      'payment_dispute.stripe_dispute_id',
      'payment_dispute.amount_minor',
      'payment_dispute.currency',
      'payment_dispute.status',
      'payment_dispute.created_at',
    ])
    .where('payment.stripe_account_id', '=', window.stripeAccountId)
    .where('payment_dispute.currency', '=', window.currency)
    .where('payment_dispute.created_at', '>=', window.periodStart)
    .where('payment_dispute.created_at', '<', window.periodEnd)
    .execute();
  const ledgerPostings = await db
    .selectFrom('ledger_posting_intent')
    .leftJoin(
      'ledger_posting_result',
      'ledger_posting_result.intent_id',
      'ledger_posting_intent.id',
    )
    .select([
      'ledger_posting_intent.payment_id',
      'ledger_posting_intent.created_at',
      'ledger_posting_intent.stripe_event_id',
      'ledger_posting_intent.posting_kind',
      'ledger_posting_intent.status as intent_status',
      'ledger_posting_result.status as result_status',
      'ledger_posting_result.error as result_error',
      'ledger_posting_result.tigerbeetle_transfer_ids as transfer_ids',
    ])
    .where('ledger_posting_intent.stripe_account_id', '=', window.stripeAccountId)
    .execute();
  return {
    payments,
    refunds,
    disputes,
    ledgerPostings: ledgerPostings.map((posting) => ({
      payment_id: posting.payment_id,
      created_at: posting.created_at,
      stripe_event_id: posting.stripe_event_id,
      posting_kind: posting.posting_kind,
      intent_status: posting.intent_status,
      result_status: posting.result_status,
      result_error: posting.result_error,
      ...(posting.transfer_ids ? { transfer_ids: posting.transfer_ids } : {}),
    })),
  };
}

async function readPlatformInputs(
  db: Db,
  window: { currency: string; periodStart: Date; periodEnd: Date },
): Promise<{
  payments: PaymentInput[];
  refunds: RefundInput[];
  ledgerPostings: LedgerPostingInput[];
}> {
  const payments = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'stripe_account_id',
      'stripe_payment_intent_id',
      'stripe_charge_id',
      'stripe_application_fee_id',
      'stripe_application_fee_minor',
      'currency',
      'customer_charge_minor',
      'project_amount_minor',
      'oss_project_fee_minor',
      'status',
      'settled_at',
      'created_at',
    ])
    .where('currency', '=', window.currency)
    .where('status', 'in', SETTLED_PAYMENT_STATUSES)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('settled_at', '>=', window.periodStart),
          eb('settled_at', '<', window.periodEnd),
        ]),
        eb.and([
          eb('created_at', '>=', window.periodStart),
          eb('created_at', '<', window.periodEnd),
        ]),
      ]),
    )
    .execute();
  const refunds = await db
    .selectFrom('refund')
    .innerJoin('payment', 'payment.id', 'refund.payment_id')
    .select([
      'refund.id',
      'refund.payment_id',
      'refund.stripe_refund_id',
      'refund.amount_minor',
      'refund.application_fee_refund_minor',
      'refund.stripe_application_fee_refund_id',
      'refund.currency',
      'refund.status',
      'refund.created_at',
    ])
    .where('payment.currency', '=', window.currency)
    .where('refund.currency', '=', window.currency)
    .where('refund.created_at', '>=', window.periodStart)
    .where('refund.created_at', '<', window.periodEnd)
    .execute();
  const ledgerPostings = await db
    .selectFrom('ledger_posting_intent')
    .innerJoin('payment', 'payment.id', 'ledger_posting_intent.payment_id')
    .leftJoin(
      'ledger_posting_result',
      'ledger_posting_result.intent_id',
      'ledger_posting_intent.id',
    )
    .select([
      'ledger_posting_intent.payment_id',
      'ledger_posting_intent.created_at',
      'ledger_posting_intent.stripe_event_id',
      'ledger_posting_intent.posting_kind',
      'ledger_posting_intent.status as intent_status',
      'ledger_posting_result.status as result_status',
      'ledger_posting_result.error as result_error',
      'ledger_posting_result.tigerbeetle_transfer_ids as transfer_ids',
    ])
    .where('payment.currency', '=', window.currency)
    .where('ledger_posting_intent.created_at', '>=', window.periodStart)
    .where('ledger_posting_intent.created_at', '<', window.periodEnd)
    .execute();
  return {
    payments,
    refunds,
    ledgerPostings: ledgerPostings.map((posting) => ({
      payment_id: posting.payment_id,
      created_at: posting.created_at,
      stripe_event_id: posting.stripe_event_id,
      posting_kind: posting.posting_kind,
      intent_status: posting.intent_status,
      result_status: posting.result_status,
      result_error: posting.result_error,
      ...(posting.transfer_ids ? { transfer_ids: posting.transfer_ids } : {}),
    })),
  };
}

export type RunDailyReconciliationArgs = {
  db: Db;
  stripe: StripeClient;
  ledger: LedgerClient;
  stripeAccountId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  now?: Date;
  retry?: boolean;
};

export type RunDailyReconciliationResult = {
  run: ReconciliationRun;
  differences: ReconciliationDifference[];
  providerNetMinor: bigint;
  ledgerNetMinor: bigint;
  skipped: boolean;
  error?: string;
};

function needsAdminAlert(differences: readonly { classification: string }[]): boolean {
  return differences.some((difference) => difference.classification !== 'timing');
}

async function recordAdminAlert(
  db: Db,
  run: ReconciliationRun,
  differences: readonly { classification: string }[],
  now: Date,
): Promise<void> {
  if (!needsAdminAlert(differences)) return;
  const existing = await db
    .selectFrom('admin_case')
    .select('id')
    .where('kind', '=', 'reconciliation_unresolved')
    .where('subject_type', '=', 'reconciliation_run')
    .where('subject_id', '=', run.id)
    .executeTakeFirst();
  if (existing) return;
  const classifications = [...new Set(differences.map((difference) => difference.classification))]
    .sort()
    .join(',');
  await db
    .insertInto('admin_case')
    .values({
      id: uuidv7(),
      kind: 'reconciliation_unresolved',
      status: 'open',
      subject_type: 'reconciliation_run',
      subject_id: run.id,
      assigned_to: null,
      notes: `Unresolved daily reconciliation (${classifications}) for ${run.stripe_account_id}/${run.currency} ${run.period_start}–${run.period_end}`,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    })
    .execute();
}

/** Run one idempotent account/currency/day reconciliation. */
export async function runDailyReconciliation(
  args: RunDailyReconciliationArgs,
): Promise<RunDailyReconciliationResult> {
  validateIdentifier(args.stripeAccountId, 'Stripe account id', 'acct_');
  const currency = normalizeCurrency(args.currency);
  const periodStart = parseDate(args.periodStart, 'Reconciliation period start');
  const periodEnd = parseDate(args.periodEnd, 'Reconciliation period end');
  if (periodStart >= periodEnd) throw new Error('Reconciliation period is invalid');
  const now = args.now ?? new Date();
  const repository = createReconciliationRepository(args.db);
  const { run, shouldRun } = await repository.beginRun(
    {
      stripeAccountId: args.stripeAccountId,
      currency,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    },
    now,
    ...(args.retry === undefined ? [] : [{ retry: args.retry }]),
  );
  if (!shouldRun) {
    const differences = await repository.listDifferences(run.id);
    await recordAdminAlert(args.db, run, differences, now);
    return {
      run,
      differences,
      providerNetMinor: minor(run.provider_net_minor),
      ledgerNetMinor: minor(run.ledger_net_minor),
      skipped: true,
    };
  }

  try {
    if (!args.stripe.listBalanceTransactions) {
      throw new Error('Stripe client does not support balance transaction reconciliation');
    }
    const providerTransactions = await args.stripe.listBalanceTransactions({
      stripeAccountId: args.stripeAccountId,
      currency,
      periodStart,
      periodEnd,
    });
    await repository.saveProviderTransactions(providerTransactions.map(providerRow));
    const inputs = await readInputs(args.db, {
      stripeAccountId: args.stripeAccountId,
      currency,
      periodStart,
      periodEnd,
    });
    const ledgerLookup = await lookupLedgerTransfers(args.ledger, inputs.ledgerPostings);
    const comparison = compareReconciliation({
      providerTransactions,
      ...inputs,
      ledgerTransfers: ledgerLookup.transfers,
      ledgerTransferLookup: ledgerLookup.lookup,
      periodStart,
      periodEnd,
      now,
    });
    const recovery = await recoverMissingStripeEvents({
      stripe: args.stripe,
      store: createDurableInboxStore(args.db),
      stripeAccountId: args.stripeAccountId,
      periodStart,
      periodEnd,
      differences: comparison.differences,
    });
    const timingRetryAt = new Date(periodEnd.getTime() + 2 * DAY_MS);
    if (
      comparison.differences.some((difference) => difference.classification === 'timing') &&
      timingRetryAt > now
    ) {
      await createJobsRepository(args.db).enqueueIfAbsent(
        dailyReconciliationJob(
          {
            stripeAccountId: args.stripeAccountId,
            currency,
            periodStart: args.periodStart,
            periodEnd: args.periodEnd,
            timingRetry: true,
          },
          timingRetryAt,
        ),
      );
    }
    if (recovery.recovered > 0) {
      await createJobsRepository(args.db).enqueueIfAbsent(
        dailyReconciliationJob(
          {
            stripeAccountId: args.stripeAccountId,
            currency,
            periodStart: args.periodStart,
            periodEnd: args.periodEnd,
            eventRetry: true,
          },
          new Date(now.getTime() + 30_000),
        ),
      );
    }
    const differences = await repository.addDifferences(
      comparison.differences.map((difference) => ({
        id: uuidv7(),
        reconciliation_run_id: run.id,
        classification: difference.classification,
        provider_object_id: difference.providerObjectId,
        expected_minor: difference.expectedMinor,
        actual_minor: difference.actualMinor,
        currency: difference.currency,
        details: difference.details,
      })),
    );
    const completed = await repository.finishRun(
      run.id,
      differences.length > 0 ? 'difference' : 'matched',
      now,
      comparison.providerNetMinor,
      comparison.ledgerNetMinor,
    );
    const alertDifferences =
      recovery.recovered > 0 && recovery.notFound === 0
        ? comparison.differences.filter(
            (difference) => difference.classification !== 'missing_event',
          )
        : comparison.differences;
    await recordAdminAlert(args.db, completed, alertDifferences, now);
    return {
      run: completed,
      differences,
      providerNetMinor: comparison.providerNetMinor,
      ledgerNetMinor: comparison.ledgerNetMinor,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = await repository.finishRun(run.id, 'failed', now);
    return {
      run: failed,
      differences: [],
      providerNetMinor: 0n,
      ledgerNetMinor: 0n,
      skipped: false,
      error: message,
    };
  }
}

export type RunPlatformReconciliationArgs = {
  db: Db;
  stripe: StripeClient;
  ledger: LedgerClient;
  currency: string;
  periodStart: string;
  periodEnd: string;
  now?: Date;
  retry?: boolean;
};

/** Run one idempotent platform/currency/day reconciliation. */
export async function runPlatformReconciliation(
  args: RunPlatformReconciliationArgs,
): Promise<RunDailyReconciliationResult> {
  const currency = normalizeCurrency(args.currency);
  const periodStart = parseDate(args.periodStart, 'Reconciliation period start');
  const periodEnd = parseDate(args.periodEnd, 'Reconciliation period end');
  if (periodStart >= periodEnd) throw new Error('Reconciliation period is invalid');
  const now = args.now ?? new Date();
  const repository = createReconciliationRepository(args.db);
  const { run, shouldRun } = await repository.beginRun(
    {
      stripeAccountId: PLATFORM_RECONCILIATION_ACCOUNT_ID,
      currency,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    },
    now,
    ...(args.retry === undefined ? [] : [{ retry: args.retry }]),
  );
  if (!shouldRun) {
    const differences = await repository.listDifferences(run.id);
    await recordAdminAlert(args.db, run, differences, now);
    return {
      run,
      differences,
      providerNetMinor: minor(run.provider_net_minor),
      ledgerNetMinor: minor(run.ledger_net_minor),
      skipped: true,
    };
  }

  try {
    if (!args.stripe.listPlatformBalanceTransactions) {
      throw new Error('Stripe client does not support platform balance reconciliation');
    }
    const providerTransactions = await args.stripe.listPlatformBalanceTransactions({
      currency,
      periodStart,
      periodEnd,
    });
    await repository.saveProviderTransactions(providerTransactions.map(providerRow));
    const inputs = await readPlatformInputs(args.db, { currency, periodStart, periodEnd });
    const ledgerLookup = await lookupLedgerTransfers(args.ledger, inputs.ledgerPostings);
    const comparison = comparePlatformReconciliation({
      providerTransactions,
      ...inputs,
      ledgerTransfers: ledgerLookup.transfers,
      ledgerTransferLookup: ledgerLookup.lookup,
      currency,
      periodStart,
      periodEnd,
      now,
    });
    const timingRetryAt = new Date(periodEnd.getTime() + 2 * DAY_MS);
    if (
      comparison.differences.some((difference) => difference.classification === 'timing') &&
      timingRetryAt > now
    ) {
      await createJobsRepository(args.db).enqueueIfAbsent(
        dailyReconciliationJob(
          {
            stripeAccountId: PLATFORM_RECONCILIATION_ACCOUNT_ID,
            currency,
            periodStart: args.periodStart,
            periodEnd: args.periodEnd,
            timingRetry: true,
          },
          timingRetryAt,
        ),
      );
    }
    const differences = await repository.addDifferences(
      comparison.differences.map((difference) => ({
        id: uuidv7(),
        reconciliation_run_id: run.id,
        classification: difference.classification,
        provider_object_id: difference.providerObjectId,
        expected_minor: difference.expectedMinor,
        actual_minor: difference.actualMinor,
        currency: difference.currency,
        details: difference.details,
      })),
    );
    const completed = await repository.finishRun(
      run.id,
      differences.length > 0 ? 'difference' : 'matched',
      now,
      comparison.providerNetMinor,
      comparison.ledgerNetMinor,
    );
    await recordAdminAlert(args.db, completed, comparison.differences, now);
    return {
      run: completed,
      differences,
      providerNetMinor: comparison.providerNetMinor,
      ledgerNetMinor: comparison.ledgerNetMinor,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = await repository.finishRun(run.id, 'failed', now);
    return {
      run: failed,
      differences: [],
      providerNetMinor: 0n,
      ledgerNetMinor: 0n,
      skipped: false,
      error: message,
    };
  }
}

export function previousUtcDay(now = new Date()): { periodStart: string; periodEnd: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - DAY_MS);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}
