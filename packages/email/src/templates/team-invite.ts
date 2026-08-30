import { emailUrl, escapeHtml, layout } from './base.js';
import { emailCopy, formatEmailDate, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderTeamInviteEmail(args: {
  projectName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const expires = formatEmailDate(args.expiresAt, args.locale);
  const role = copy.teamInvite.roles[args.role] ?? args.role;
  const subject = interpolate(copy.teamInvite.subject, { projectName: args.projectName });
  const text = interpolate(copy.teamInvite.text, {
    projectName: args.projectName,
    role,
    inviteUrl: args.inviteUrl,
    expires,
  });
  const inviteUrl = emailUrl(args.inviteUrl);
  const html = layout(
    subject,
    `<p>${interpolate(copy.teamInvite.intro, { role: escapeHtml(role), projectName: escapeHtml(args.projectName) })}</p><p><a href="${inviteUrl}">${copy.teamInvite.accept}</a></p><p>${interpolate(copy.teamInvite.expires, { expires: escapeHtml(expires) })}</p>`,
  );
  return { subject, html, text };
}
