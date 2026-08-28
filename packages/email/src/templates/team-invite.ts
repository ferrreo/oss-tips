import { layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderTeamInviteEmail(args: {
  projectName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}): RenderedEmail {
  const subject = `Invitation to join ${args.projectName} on oss.tips`;
  const text = `You have been invited as ${args.role} on ${args.projectName}. Accept: ${args.inviteUrl} (expires ${args.expiresAt})`;
  const html = layout(
    subject,
    `<p>You have been invited as <strong>${args.role}</strong> on <strong>${args.projectName}</strong>.</p><p><a href="${args.inviteUrl}">Accept invitation</a></p><p>Expires: ${args.expiresAt}</p>`,
  );
  return { subject, html, text };
}
