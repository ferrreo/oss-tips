import { computeFeeAllocation, type FeatureMode } from '@oss-tips/domain';
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

export type PostingIntent = {
  postingKind: string;
  postingVersion: number;
  semanticKey: string;
  currency: string;
  transfers: LedgerTransfer[];
  metadata: {
    stripeAccountId: string;
    stripeEventId: string;
    paymentId: string;
    projectId: string;
    featureMode: FeatureMode;
    projectAmountMinor: bigint;
    platformTipMinor: bigint;
    customerChargeMinor: bigint;
  };
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
    clearing: accountId(AccountCode.StripeExternalClearing, 'stripe_account', input.stripeAccountId, currency),
    transit: accountId(AccountCode.PaymentTransit, 'payment', input.paymentId, currency),
    projectGross: accountId(AccountCode.ProjectGrossSupport, 'project', input.projectId, currency),
    platformFee: accountId(AccountCode.PlatformProjectFeeRevenue, 'platform', 'oss.tips', currency),
    platformTip: accountId(AccountCode.PlatformSupporterTipRevenue, 'platform', 'oss.tips', currency),
  };
}

/**
 * Build linked posting transfers for one-off settlement.
 * Matches docs/03 §7 examples for standard and 5% modes.
 */
export function buildOneOffSettlementIntent(input: OneOffSettlementInput): PostingIntent {
  const postingVersion = input.postingVersion ?? 1;
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
  const customerCharge = allocation.customerCharge.amountMinor;
  const projectShare = allocation.projectBeforeStripe.amountMinor;
  const platformFee = allocation.ossProjectFee.amountMinor;
  const platformTip = allocation.platformTip.amountMinor;

  const transfers: LedgerTransfer[] = [];
  let index = 0;

  const push = (
    code: number,
    debit: LedgerId,
    credit: LedgerId,
    amount: bigint,
    linked: boolean,
  ) => {
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
      linked,
    });
    index += 1;
  };

  // Clearing -> transit (customer charge)
  push(
    TransferCode.SettledPaymentIntoTransit,
    accounts.clearing,
    accounts.transit,
    customerCharge,
    false,
  );

  // Transit -> project gross
  push(
    TransferCode.TransitToProjectGross,
    accounts.transit,
    accounts.projectGross,
    projectShare,
    true,
  );

  // Transit -> platform project fee (5% mode only)
  if (platformFee > 0n) {
    push(
      TransferCode.TransitToPlatformProjectFee,
      accounts.transit,
      accounts.platformFee,
      platformFee,
      true,
    );
  }

  // Transit -> platform tip
  if (platformTip > 0n) {
    push(
      TransferCode.TransitToPlatformSupporterTip,
      accounts.transit,
      accounts.platformTip,
      platformTip,
      true,
    );
  }

  return {
    postingKind,
    postingVersion,
    semanticKey,
    currency: input.currency.toLowerCase(),
    transfers,
    metadata: {
      stripeAccountId: input.stripeAccountId,
      stripeEventId: input.stripeEventId,
      paymentId: input.paymentId,
      projectId: input.projectId,
      featureMode: input.featureMode,
      projectAmountMinor: allocation.projectAmount.amountMinor,
      platformTipMinor: allocation.platformTip.amountMinor,
      customerChargeMinor: customerCharge,
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
