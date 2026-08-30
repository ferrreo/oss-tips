import { escapeHtml, layout, moneyLine } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderRefundEmail(args: {
  projectName: string;
  refundAmount: string;
  currency: string;
  platformFeesRefunded: string;
  reason?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.refund.subject, { projectName: args.projectName });
  const money = moneyLine(args.refundAmount, args.currency, args.platformFeesRefunded, args.locale);
  const text = `${interpolate(copy.refund.text, { projectName: args.projectName, money })}${args.reason ? `\n${interpolate(copy.refund.reason, { reason: args.reason })}` : ''}`;
  const html = layout(
    subject,
    `<p>${interpolate(copy.refund.intro, { projectName: escapeHtml(args.projectName) })}</p><p>${escapeHtml(money)}</p>${args.reason ? `<p>${interpolate(copy.refund.reason, { reason: escapeHtml(args.reason) })}</p>` : ''}`,
  );
  return { subject, html, text };
}

export function renderDisputeEmail(args: {
  projectName: string;
  disputeStatus: string;
  amount: string;
  currency: string;
  platformFees?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.refund.disputeSubject, { projectName: args.projectName });
  const money = args.platformFees
    ? moneyLine(args.amount, args.currency, args.platformFees, args.locale)
    : undefined;
  const text =
    interpolate(copy.refund.disputeText, {
      status: args.disputeStatus,
      amount: args.amount,
      currency: args.currency.toUpperCase(),
    }) + (money ? `\n${money}` : '');
  const html = layout(
    subject,
    `<p>${interpolate(copy.refund.disputeIntro, { projectName: escapeHtml(args.projectName) })}</p><p>${copy.refund.status}: ${escapeHtml(args.disputeStatus)}</p><p>${copy.refund.amount}: ${escapeHtml(args.amount)} ${escapeHtml(args.currency.toUpperCase())}</p>${money ? `<p>${escapeHtml(money)}</p>` : ''}`,
  );
  return { subject, html, text };
}
