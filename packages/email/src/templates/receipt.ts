import { emailUrl, escapeHtml, layout, moneyLine } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderReceiptEmail(args: {
  projectName: string;
  projectAmount: string;
  currency: string;
  platformFees: string;
  receiptUrl: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.receipt.subject, { projectName: args.projectName });
  const money = moneyLine(args.projectAmount, args.currency, args.platformFees, args.locale);
  const text = `${money}\n${copy.receipt.view}: ${args.receiptUrl}`;
  const receiptUrl = emailUrl(args.receiptUrl);
  const html = layout(
    subject,
    `<p>${copy.receipt.thanks} <strong>${escapeHtml(args.projectName)}</strong>.</p><p>${escapeHtml(money)}</p><p><a href="${receiptUrl}">${copy.receipt.view}</a></p>`,
  );
  return { subject, html, text };
}
