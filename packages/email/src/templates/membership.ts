import { layout, moneyLine } from './base.js';
import type { RenderedEmail } from '../types.js';

export type MembershipEvent =
  | 'started'
  | 'renewed'
  | 'cancelled'
  | 'payment_failed'
  | 'grace_ending';

const TITLES: Record<MembershipEvent, string> = {
  started: 'Membership started',
  renewed: 'Membership renewed',
  cancelled: 'Membership cancelled',
  payment_failed: 'Membership payment failed',
  grace_ending: 'Membership grace period ending',
};

export function renderMembershipEmail(args: {
  event: MembershipEvent;
  projectName: string;
  projectAmount: string;
  currency: string;
  platformFees: string;
  manageUrl?: string | undefined;
}): RenderedEmail {
  const title = TITLES[args.event];
  const subject = `${title} — ${args.projectName}`;
  const money = moneyLine(args.projectAmount, args.currency, args.platformFees);
  const text = `${title} for ${args.projectName}. ${money}${args.manageUrl ? `\nManage: ${args.manageUrl}` : ''}`;
  const html = layout(
    subject,
    `<p><strong>${title}</strong> for ${args.projectName}.</p><p>${money}</p>${args.manageUrl ? `<p><a href="${args.manageUrl}">Manage membership</a></p>` : ''}`,
  );
  return { subject, html, text };
}
