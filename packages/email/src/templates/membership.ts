import { emailUrl, escapeHtml, layout, moneyLine } from './base.js';
import { emailCopy, interpolate, type MembershipEmailEvent } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export type MembershipEvent = MembershipEmailEvent;

export function renderMembershipEmail(args: {
  event: MembershipEvent;
  projectName: string;
  projectAmount: string;
  currency: string;
  platformFees: string;
  manageUrl?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const title = copy.membership.titles[args.event];
  const subject = interpolate(copy.membership.subject, { title, projectName: args.projectName });
  const money = moneyLine(args.projectAmount, args.currency, args.platformFees, args.locale);
  const text = `${interpolate(copy.membership.text, { title, projectName: args.projectName })} ${money}${args.manageUrl ? `\n${copy.membership.manage}: ${args.manageUrl}` : ''}`;
  const projectName = escapeHtml(args.projectName);
  const manageUrl = args.manageUrl ? emailUrl(args.manageUrl) : null;
  const html = layout(
    subject,
    `<p>${interpolate(copy.membership.body, { title: escapeHtml(title), projectName })}</p><p>${escapeHtml(money)}</p>${manageUrl ? `<p><a href="${manageUrl}">${copy.membership.manage}</a></p>` : ''}`,
  );
  return { subject, html, text };
}
