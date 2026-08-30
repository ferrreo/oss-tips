import type { Db } from '@oss-tips/db';
import {
  netSettledProjectAmountMinor,
  type ProjectAggregateDisputeRow,
  type ProjectAggregatePaymentRow,
  type ProjectAggregateRefundRow,
} from './page-data';

export type PublicSupportPaymentRow = ProjectAggregatePaymentRow;

export type PublicSupportAdjustments = {
  refunds: ProjectAggregateRefundRow[];
  disputes: ProjectAggregateDisputeRow[];
};

/** Read only persisted corrections for a set of payment rows. */
export async function readPublicSupportAdjustments(
  db: Db,
  paymentIds: readonly string[],
): Promise<PublicSupportAdjustments> {
  if (paymentIds.length === 0) return { refunds: [], disputes: [] };
  const [refunds, disputes] = await Promise.all([
    db
      .selectFrom('refund')
      .select(['payment_id', 'amount_minor', 'application_fee_refund_minor', 'status'])
      .where('payment_id', 'in', [...paymentIds])
      .execute(),
    db
      .selectFrom('payment_dispute')
      .select(['payment_id', 'amount_minor', 'status'])
      .where('payment_id', 'in', [...paymentIds])
      .execute(),
  ]);
  return { refunds, disputes };
}

/** Keep public support rows settled and net of successful corrections. */
export function visiblePublicSupportPayments<T extends PublicSupportPaymentRow>(
  rows: readonly T[],
  adjustments: PublicSupportAdjustments,
): Array<{ row: T; amountMinor: bigint }> {
  return rows.flatMap((row) => {
    const amountMinor = netSettledProjectAmountMinor(
      row,
      adjustments.refunds,
      adjustments.disputes,
    );
    return amountMinor > 0n ? [{ row, amountMinor }] : [];
  });
}
