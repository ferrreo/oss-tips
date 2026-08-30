import {
  computeFeeAllocation,
  proportionalPlatformRefund,
  type FeatureMode,
} from '@oss-tips/domain';
import { AccountCode, TransferCode, ledgerForCurrency } from './codes.js';
import { accountId, transferId, type LedgerId } from './ids.js';

export type LedgerTransfer = {
  id: LedgerId;
  debitAccountId: LedgerId;
  creditAccountId: LedgerId;
  amount: bigint;
  ledger: number;
  code: number;
  linked: boolean;
};

export type LedgerAccountDefinition = {
  id: LedgerId;
  ledger: number;
  code: number;
};

export type PostingMetadata = {
  stripeAccountId: string;
  stripeEventId: string;
  paymentId: string;
  projectId: string;
  featureMode: FeatureMode;
  projectAmountMinor: bigint;
  platformTipMinor: bigint;
  customerChargeMinor: bigint;
  projectShareMinor?: bigint;
  platformFeeMinor?: bigint;
  refundCustomerChargeMinor?: bigint;
  correctionKind?: 'refund' | 'dispute_opened' | 'dispute_won' | 'dispute_lost';
};

export type PostingIntent = {
  postingKind: string;
  postingVersion: number;
  semanticKey: string;
  currency: string;
  transfers: LedgerTransfer[];
  /** Exact account codes used by this intent; replay must not guess from IDs. */
  accountDefinitions?: LedgerAccountDefinition[];
  metadata: PostingMetadata;
};

export type OneOffSettlementInput = {
  stripeAccountId: string;
  stripeEventId: string;
  paymentId: string;
  projectId: string;
  currency: string;
  projectAmountMinor: bigint | number;
  platformTipMinor: bigint | number;
  featureMode: FeatureMode;
  postingVersion?: number;
};

function scopeAccounts(input: {
  stripeAccountId: string;
  paymentId: string;
  projectId: string;
  currency: string;
}) {
  const currency = input.currency.toLowerCase();
  return {
    clearing: accountId(
      AccountCode.StripeExternalClearing,
      'stripe_account',
      input.stripeAccountId,
      currency,
    ),
    transit: accountId(AccountCode.PaymentTransit, 'payment', input.paymentId, currency),
    projectGross: accountId(AccountCode.ProjectGrossSupport, 'project', input.projectId, currency),
    platformFee: accountId(AccountCode.PlatformProjectFeeRevenue, 'platform', 'oss.tips', currency),
    platformTip: accountId(
      AccountCode.PlatformSupporterTipRevenue,
      'platform',
      'oss.tips',
      currency,
    ),
  };
}

function asMinor(value: bigint | number, label: string): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  const amount = BigInt(value);
  if (amount < 0n) throw new Error(`${label} must be non-negative`);
  return amount;
}

function version(value: number | undefined): number {
  const postingVersion = value ?? 1;
  if (!Number.isSafeInteger(postingVersion) || postingVersion <= 0) {
    throw new Error('posting version must be a positive integer');
  }
  return postingVersion;
}

function accountDefinitions(
  transfers: readonly LedgerTransfer[],
  codes: ReadonlyMap<LedgerId, number>,
): LedgerAccountDefinition[] {
  const definitions = new Map<LedgerId, LedgerAccountDefinition>();
  for (const transfer of transfers) {
    for (const id of [transfer.debitAccountId, transfer.creditAccountId]) {
      if (!definitions.has(id)) {
        definitions.set(id, {
          id,
          ledger: transfer.ledger,
          code: codes.get(id) ?? AccountCode.UnreconciledSuspense,
        });
      }
    }
  }
  return [...definitions.values()];
}

function linkTransfers(transfers: LedgerTransfer[]): LedgerTransfer[] {
  return transfers.map((transfer, index) => ({
    ...transfer,
    // TigerBeetle linked chains mark every transfer except the final one.
    linked: index < transfers.length - 1,
  }));
}

/**
 * Build linked posting transfers for one-off settlement.
 * Matches docs/03 §7 examples for standard and 5% modes.
 */
export function buildOneOffSettlementIntent(input: OneOffSettlementInput): PostingIntent {
  const postingVersion = version(input.postingVersion);
  const postingKind = 'one_off_settlement';
  const semanticKey = [
    input.stripeAccountId,
    input.stripeEventId,
    postingKind,
    String(postingVersion),
  ].join(':');

  const allocation = computeFeeAllocation({
    projectAmountMinor: input.projectAmountMinor,
    platformTipMinor: input.platformTipMinor,
    currency: input.currency,
    featureMode: input.featureMode,
    cadence: 'one_off',
  });

  const ledger = ledgerForCurrency(input.currency);
  const accounts = scopeAccounts(input);
  const customerCharge = asMinor(allocation.customerCharge.amountMinor, 'customer charge');
  const projectShare = asMinor(allocation.projectBeforeStripe.amountMinor, 'project share');
  const platformFee = asMinor(allocation.ossProjectFee.amountMinor, 'platform fee');
  const platformTip = asMinor(allocation.platformTip.amountMinor, 'platform tip');
  if (customerCharge <= 0n) throw new Error('customer charge must be positive');

  const transfers: LedgerTransfer[] = [];
  let index = 0;

  const push = (code: number, debit: LedgerId, credit: LedgerId, amount: bigint) => {
    if (amount <= 0n) return;
    transfers.push({
      id: transferId(
        input.stripeAccountId,
        input.stripeEventId,
        postingKind,
        postingVersion,
        index,
      ),
      debitAccountId: debit,
      creditAccountId: credit,
      amount,
      ledger,
      code,
      linked: false,
    });
    index += 1;
  };

  // Clearing -> transit (customer charge)
  push(TransferCode.SettledPaymentIntoTransit, accounts.clearing, accounts.transit, customerCharge);

  // Transit -> project gross
  push(TransferCode.TransitToProjectGross, accounts.transit, accounts.projectGross, projectShare);

  // Transit -> platform project fee (5% mode only)
  if (platformFee > 0n) {
    push(
      TransferCode.TransitToPlatformProjectFee,
      accounts.transit,
      accounts.platformFee,
      platformFee,
    );
  }

  // Transit -> platform tip
  if (platformTip > 0n) {
    push(
      TransferCode.TransitToPlatformSupporterTip,
      accounts.transit,
      accounts.platformTip,
      platformTip,
    );
  }

  const linkedTransfers = linkTransfers(transfers);
  const codes = new Map<LedgerId, number>([
    [accounts.clearing, AccountCode.StripeExternalClearing],
    [accounts.transit, AccountCode.PaymentTransit],
    [accounts.projectGross, AccountCode.ProjectGrossSupport],
    [accounts.platformFee, AccountCode.PlatformProjectFeeRevenue],
    [accounts.platformTip, AccountCode.PlatformSupporterTipRevenue],
  ]);

  return {
    postingKind,
    postingVersion,
    semanticKey,
    currency: input.currency.toLowerCase(),
    transfers: linkedTransfers,
    accountDefinitions: accountDefinitions(linkedTransfers, codes),
    metadata: {
      stripeAccountId: input.stripeAccountId,
      stripeEventId: input.stripeEventId,
      paymentId: input.paymentId,
      projectId: input.projectId,
      featureMode: input.featureMode,
      projectAmountMinor: allocation.projectAmount.amountMinor,
      platformTipMinor: allocation.platformTip.amountMinor,
      customerChargeMinor: customerCharge,
      projectShareMinor: projectShare,
      platformFeeMinor: platformFee,
    },
  };
}

export type OneOffRefundInput = {
  stripeAccountId: string;
  stripeEventId: string;
  paymentId: string;
  projectId: string;
  currency: string;
  refundCustomerChargeMinor: bigint | number;
  originalCustomerChargeMinor: bigint | number;
  originalProjectShareMinor: bigint | number;
  originalPlatformFeeMinor: bigint | number;
  originalPlatformTipMinor: bigint | number;
  originalProjectAmountMinor?: bigint | number;
  featureMode?: FeatureMode;
  postingVersion?: number;
};

function proportionalPart(total: bigint, originalTotal: bigint, amount: bigint): bigint {
  if (total <= 0n || amount <= 0n) return 0n;
  if (amount >= originalTotal) return total;
  return (total * amount + originalTotal / 2n) / originalTotal;
}

/**
 * Build immutable reverse-direction transfers for a full or partial refund.
 * Each allocation is reversed independently, while rounding is absorbed by
 * the tip so the customer refund always balances exactly.
 */
export function buildOneOffRefundIntent(input: OneOffRefundInput): PostingIntent {
  const postingVersion = version(input.postingVersion);
  const postingKind = 'one_off_refund';
  const semanticKey = [
    input.stripeAccountId,
    input.stripeEventId,
    postingKind,
    String(postingVersion),
  ].join(':');
  const currency = input.currency.toLowerCase();
  const ledger = ledgerForCurrency(currency);
  const originalCharge = asMinor(input.originalCustomerChargeMinor, 'original customer charge');
  const refundAmount = asMinor(input.refundCustomerChargeMinor, 'refund amount');
  const originalProjectShare = asMinor(input.originalProjectShareMinor, 'original project share');
  const originalPlatformFee = asMinor(input.originalPlatformFeeMinor, 'original platform fee');
  const originalPlatformTip = asMinor(input.originalPlatformTipMinor, 'original platform tip');
  const originalProjectAmount = asMinor(
    input.originalProjectAmountMinor ?? originalProjectShare + originalPlatformFee,
    'original project amount',
  );
  if (originalCharge <= 0n) throw new Error('original customer charge must be positive');
  if (refundAmount <= 0n) throw new Error('refund amount must be positive');
  if (refundAmount > originalCharge) throw new Error('refund amount exceeds original charge');
  if (originalProjectShare + originalPlatformFee + originalPlatformTip !== originalCharge) {
    throw new Error('original allocation does not balance to customer charge');
  }
  if (originalProjectAmount - originalPlatformFee !== originalProjectShare) {
    throw new Error('original project amount does not match project allocation');
  }

  const platformApplicationFee = originalPlatformFee + originalPlatformTip;
  const platformRefund = proportionalPlatformRefund({
    originalCustomerChargeMinor: originalCharge,
    refundCustomerChargeMinor: refundAmount,
    originalApplicationFeeMinor: platformApplicationFee,
  });
  const projectRefund = refundAmount - platformRefund;
  const feeRefund = proportionalPart(platformRefund, platformApplicationFee, originalPlatformFee);
  const tipRefund = platformRefund - feeRefund;
  if (projectRefund < 0n || feeRefund < 0n || tipRefund < 0n) {
    throw new Error('refund allocation is negative');
  }

  const clearing = accountId(
    AccountCode.StripeExternalClearing,
    'stripe_account',
    input.stripeAccountId,
    currency,
  );
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
  let index = 0;
  const push = (
    code: number,
    debitAccountId: LedgerId,
    creditAccountId: LedgerId,
    amount: bigint,
  ) => {
    if (amount <= 0n) return;
    transfers.push({
      id: transferId(
        input.stripeAccountId,
        input.stripeEventId,
        postingKind,
        postingVersion,
        index++,
      ),
      debitAccountId,
      creditAccountId,
      amount,
      ledger,
      code,
      linked: false,
    });
  };

  push(TransferCode.ProjectRefund, projectGross, clearing, projectRefund);
  push(TransferCode.ApplicationFeeRefund, platformFee, clearing, feeRefund);
  push(TransferCode.ApplicationFeeRefund, platformTip, clearing, tipRefund);

  if (transfers.length === 0) throw new Error('refund produced no ledger transfers');
  const linkedTransfers = linkTransfers(transfers);
  const codes = new Map<LedgerId, number>([
    [clearing, AccountCode.StripeExternalClearing],
    [projectGross, AccountCode.ProjectGrossSupport],
    [platformFee, AccountCode.PlatformProjectFeeRevenue],
    [platformTip, AccountCode.PlatformSupporterTipRevenue],
  ]);

  return {
    postingKind,
    postingVersion,
    semanticKey,
    currency,
    transfers: linkedTransfers,
    accountDefinitions: accountDefinitions(linkedTransfers, codes),
    metadata: {
      stripeAccountId: input.stripeAccountId,
      stripeEventId: input.stripeEventId,
      paymentId: input.paymentId,
      projectId: input.projectId,
      featureMode: input.featureMode ?? 'standard',
      projectAmountMinor: originalProjectAmount,
      platformTipMinor: originalPlatformTip,
      customerChargeMinor: originalCharge,
      projectShareMinor: originalProjectShare,
      platformFeeMinor: originalPlatformFee,
      refundCustomerChargeMinor: refundAmount,
      correctionKind: 'refund',
    },
  };
}

/** Short alias for callers that do not need to name one-off explicitly. */
export const buildRefundIntent = buildOneOffRefundIntent;

export type DisputeIntentInput = {
  stripeAccountId: string;
  stripeEventId: string;
  paymentId: string;
  projectId: string;
  currency: string;
  amountMinor: bigint | number;
  outcome: 'opened' | 'won' | 'lost';
  /** Original charge allocation; omitted for legacy project-only postings. */
  originalCustomerChargeMinor?: bigint | number;
  originalProjectShareMinor?: bigint | number;
  originalPlatformFeeMinor?: bigint | number;
  originalPlatformTipMinor?: bigint | number;
  postingVersion?: number;
};

/** Build the immutable suspense movement for a dispute lifecycle transition. */
export function buildDisputeIntent(input: DisputeIntentInput): PostingIntent {
  const postingVersion = version(input.postingVersion);
  const currency = input.currency.toLowerCase();
  const ledger = ledgerForCurrency(currency);
  const amount = asMinor(input.amountMinor, 'dispute amount');
  if (amount <= 0n) throw new Error('dispute amount must be positive');
  const allocationFields = [
    input.originalCustomerChargeMinor,
    input.originalProjectShareMinor,
    input.originalPlatformFeeMinor,
    input.originalPlatformTipMinor,
  ];
  const hasAllocation = allocationFields.some((value) => value !== undefined);
  if (hasAllocation && allocationFields.some((value) => value === undefined)) {
    throw new Error('dispute allocation is incomplete');
  }
  const originalCharge = asMinor(
    input.originalCustomerChargeMinor ?? amount,
    'original customer charge',
  );
  const originalProjectShare = asMinor(
    input.originalProjectShareMinor ?? originalCharge,
    'original project share',
  );
  const originalPlatformFee = asMinor(
    input.originalPlatformFeeMinor ?? 0n,
    'original platform fee',
  );
  const originalPlatformTip = asMinor(
    input.originalPlatformTipMinor ?? 0n,
    'original platform tip',
  );
  if (originalCharge <= 0n) throw new Error('original customer charge must be positive');
  if (amount > originalCharge) throw new Error('dispute amount exceeds original charge');
  if (originalProjectShare + originalPlatformFee + originalPlatformTip !== originalCharge) {
    throw new Error('original dispute allocation does not balance to customer charge');
  }
  const platformApplicationFee = originalPlatformFee + originalPlatformTip;
  const platformDispute = proportionalPlatformRefund({
    originalCustomerChargeMinor: originalCharge,
    refundCustomerChargeMinor: amount,
    originalApplicationFeeMinor: platformApplicationFee,
  });
  const projectDispute = amount - platformDispute;
  const feeDispute = proportionalPart(platformDispute, platformApplicationFee, originalPlatformFee);
  const tipDispute = platformDispute - feeDispute;
  if (projectDispute < 0n || feeDispute < 0n || tipDispute < 0n) {
    throw new Error('dispute allocation is negative');
  }
  const projectGross = accountId(
    AccountCode.ProjectGrossSupport,
    'project',
    input.projectId,
    currency,
  );
  const suspense = accountId(
    AccountCode.UnreconciledSuspense,
    'stripe_account',
    input.stripeAccountId,
    currency,
  );
  const projectLoss = accountId(
    AccountCode.ProjectRefundDisputeLoss,
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
  const postingKind = `dispute_${input.outcome}`;
  const semanticKey = [
    input.stripeAccountId,
    input.stripeEventId,
    postingKind,
    String(postingVersion),
  ].join(':');

  const transfers: LedgerTransfer[] = [];
  let index = 0;
  const push = (
    debitAccountId: LedgerId,
    creditAccountId: LedgerId,
    transferAmount: bigint,
    code: number,
  ) => {
    if (transferAmount <= 0n) return;
    transfers.push({
      id: transferId(
        input.stripeAccountId,
        input.stripeEventId,
        postingKind,
        postingVersion,
        index++,
      ),
      debitAccountId,
      creditAccountId,
      amount: transferAmount,
      ledger,
      code,
      linked: false,
    });
  };
  if (input.outcome === 'opened') {
    push(projectGross, suspense, projectDispute, TransferCode.DisputeOpened);
    push(platformFee, suspense, feeDispute, TransferCode.DisputeOpened);
    push(platformTip, suspense, tipDispute, TransferCode.DisputeOpened);
  } else if (input.outcome === 'won') {
    push(suspense, projectGross, projectDispute, TransferCode.DisputeWonReversal);
    push(suspense, platformFee, feeDispute, TransferCode.DisputeWonReversal);
    push(suspense, platformTip, tipDispute, TransferCode.DisputeWonReversal);
  } else {
    push(suspense, projectLoss, amount, TransferCode.DisputeLostFinal);
  }
  if (transfers.length === 0) throw new Error('dispute produced no ledger transfers');
  const linkedTransfers = linkTransfers(transfers);
  const codes = new Map<LedgerId, number>([
    [projectGross, AccountCode.ProjectGrossSupport],
    [platformFee, AccountCode.PlatformProjectFeeRevenue],
    [platformTip, AccountCode.PlatformSupporterTipRevenue],
    [suspense, AccountCode.UnreconciledSuspense],
    [projectLoss, AccountCode.ProjectRefundDisputeLoss],
  ]);

  return {
    postingKind,
    postingVersion,
    semanticKey,
    currency,
    transfers: linkedTransfers,
    accountDefinitions: accountDefinitions(linkedTransfers, codes),
    metadata: {
      stripeAccountId: input.stripeAccountId,
      stripeEventId: input.stripeEventId,
      paymentId: input.paymentId,
      projectId: input.projectId,
      featureMode: 'standard',
      projectAmountMinor: originalProjectShare,
      platformTipMinor: originalPlatformTip,
      customerChargeMinor: amount,
      correctionKind: `dispute_${input.outcome}`,
    },
  };
}

/** Sum signed balance deltas per account from transfers (debit negative, credit positive). */
export function netBalancesFromTransfers(
  transfers: readonly LedgerTransfer[],
): Map<LedgerId, bigint> {
  const balances = new Map<LedgerId, bigint>();
  const add = (accountId: LedgerId, delta: bigint) => {
    balances.set(accountId, (balances.get(accountId) ?? 0n) + delta);
  };
  for (const t of transfers) {
    add(t.debitAccountId, -t.amount);
    add(t.creditAccountId, t.amount);
  }
  return balances;
}

export function transitBalance(
  transfers: readonly LedgerTransfer[],
  transitAccountId: LedgerId,
): bigint {
  return netBalancesFromTransfers(transfers).get(transitAccountId) ?? 0n;
}
