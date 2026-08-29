import { layout, moneyLine } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderRefundEmail(args: {
  projectName: string;
  refundAmount: string;
  currency: string;
  platformFeesRefunded: string;
  reason?: string | undefined;
}): RenderedEmail {
  const subject = `Refund from ${args.projectName}`;
  const money = moneyLine(args.refundAmount, args.currency, args.platformFeesRefunded);
  const text = `A refund was issued for ${args.projectName}. ${money}${args.reason ? `\nReason: ${args.reason}` : ''}`;
  const html = layout(
    subject,
    `<p>A refund was issued for <strong>${args.projectName}</strong>.</p><p>${money}</p>${args.reason ? `<p>Reason: ${args.reason}</p>` : ''}`,
  );
  return { subject, html, text };
}

export function renderDisputeEmail(args: {
  projectName: string;
  disputeStatus: string;
  amount: string;
  currency: string;
}): RenderedEmail {
  const subject = `Dispute update — ${args.projectName}`;
  const text = `Dispute status: ${args.disputeStatus}. Amount: ${args.amount} ${args.currency}`;
  const html = layout(
    subject,
    `<p>Dispute update for <strong>${args.projectName}</strong>.</p><p>Status: ${args.disputeStatus}</p><p>Amount: ${args.amount} ${args.currency}</p>`,
  );
  return { subject, html, text };
}
