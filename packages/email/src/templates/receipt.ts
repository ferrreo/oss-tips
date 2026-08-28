import { layout, moneyLine } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderReceiptEmail(args: {
  projectName: string;
  projectAmount: string;
  currency: string;
  platformFees: string;
  receiptUrl: string;
}): RenderedEmail {
  const subject = `Receipt for your support of ${args.projectName}`;
  const money = moneyLine(args.projectAmount, args.currency, args.platformFees);
  const text = `${money}\nView receipt: ${args.receiptUrl}`;
  const html = layout(
    subject,
    `<p>Thank you for supporting <strong>${args.projectName}</strong>.</p><p>${money}</p><p><a href="${args.receiptUrl}">View receipt</a></p>`,
  );
  return { subject, html, text };
}
