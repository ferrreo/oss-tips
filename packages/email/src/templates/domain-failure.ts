import { layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderDomainFailureEmail(args: {
  projectName: string;
  domain: string;
  failure: string;
  actionUrl?: string | undefined;
}): RenderedEmail {
  const subject = `Custom domain issue — ${args.domain}`;
  const text = `Domain ${args.domain} for ${args.projectName} failed: ${args.failure}${args.actionUrl ? `\nFix: ${args.actionUrl}` : ''}`;
  const html = layout(
    subject,
    `<p>Custom domain <strong>${args.domain}</strong> for ${args.projectName} needs attention.</p><p>${args.failure}</p>${args.actionUrl ? `<p><a href="${args.actionUrl}">Review domain settings</a></p>` : ''}`,
  );
  return { subject, html, text };
}

export function renderStripeRestrictionEmail(args: {
  projectName: string;
  restriction: string;
}): RenderedEmail {
  const subject = `Stripe account restriction — ${args.projectName}`;
  const text = `Stripe restriction for ${args.projectName}: ${args.restriction}`;
  const html = layout(
    subject,
    `<p>Stripe account restriction for <strong>${args.projectName}</strong>:</p><p>${args.restriction}</p>`,
  );
  return { subject, html, text };
}

export function renderProjectReviewEmail(args: {
  projectName: string;
  status: 'approved' | 'rejected' | 'action_required';
  detail?: string | undefined;
}): RenderedEmail {
  const labels = { approved: 'approved', rejected: 'rejected', action_required: 'action required' };
  const subject = `Project ${labels[args.status]} — ${args.projectName}`;
  const text = `${args.projectName} was ${labels[args.status]}.${args.detail ? ` ${args.detail}` : ''}`;
  const html = layout(subject, `<p><strong>${args.projectName}</strong> was ${labels[args.status]}.</p>${args.detail ? `<p>${args.detail}</p>` : ''}`);
  return { subject, html, text };
}

export function renderSecurityChangeEmail(args: {
  projectName: string;
  change: string;
}): RenderedEmail {
  const subject = `Security change — ${args.projectName}`;
  const text = `Security change for ${args.projectName}: ${args.change}`;
  const html = layout(subject, `<p>Security change for <strong>${args.projectName}</strong>:</p><p>${args.change}</p>`);
  return { subject, html, text };
}
