import { isSupportedCurrency, type SupportedCurrency } from '@oss-tips/domain';

/** TigerBeetle account code registry (docs/03 §5). */
export const AccountCode = {
  StripeExternalClearing: 100,
  PaymentTransit: 110,
  ProjectGrossSupport: 200,
  ProjectStripeFeeExpense: 210,
  ProjectRefundDisputeLoss: 220,
  PlatformProjectFeeRevenue: 300,
  PlatformSupporterTipRevenue: 310,
  PlatformFeeRefundContra: 320,
  UnreconciledSuspense: 400,
} as const;

export type AccountCode = (typeof AccountCode)[keyof typeof AccountCode];

/** TigerBeetle transfer code registry (docs/03 §6). */
export const TransferCode = {
  SettledPaymentIntoTransit: 1000,
  TransitToProjectGross: 1010,
  TransitToPlatformProjectFee: 1020,
  TransitToPlatformSupporterTip: 1030,
  StripeProcessingFeeAttribution: 1040,
  ProjectRefund: 1100,
  ApplicationFeeRefund: 1110,
  DisputeOpened: 1120,
  DisputeWonReversal: 1130,
  DisputeLostFinal: 1140,
  ManualCorrection: 1200,
  ReconciliationSuspense: 1300,
} as const;

export type TransferCode = (typeof TransferCode)[keyof typeof TransferCode];

/** Static ledger number per ISO 4217 currency. */
const LEDGER_BY_CURRENCY: Record<SupportedCurrency, number> = {
  gbp: 826,
  usd: 840,
  eur: 978,
  jpy: 392,
};

export function ledgerForCurrency(currency: string): number {
  const normalized = currency.toLowerCase();
  if (!isSupportedCurrency(normalized)) {
    throw new Error(`Unsupported currency for ledger: ${currency}`);
  }
  return LEDGER_BY_CURRENCY[normalized];
}

export const ACCOUNT_CODE_LABELS: Record<AccountCode, string> = {
  [AccountCode.StripeExternalClearing]: 'Stripe external clearing',
  [AccountCode.PaymentTransit]: 'Payment transit',
  [AccountCode.ProjectGrossSupport]: 'Project gross support',
  [AccountCode.ProjectStripeFeeExpense]: 'Project estimated Stripe fee expense',
  [AccountCode.ProjectRefundDisputeLoss]: 'Project refund/dispute loss',
  [AccountCode.PlatformProjectFeeRevenue]: 'oss.tips project-fee revenue',
  [AccountCode.PlatformSupporterTipRevenue]: 'oss.tips supporter-tip revenue',
  [AccountCode.PlatformFeeRefundContra]: 'oss.tips fee-refund contra revenue',
  [AccountCode.UnreconciledSuspense]: 'Unreconciled/suspense',
};
