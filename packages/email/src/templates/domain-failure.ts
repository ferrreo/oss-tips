import { emailUrl, escapeHtml, layout } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderDomainFailureEmail(args: {
  projectName: string;
  domain: string;
  failure: string;
  actionUrl?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.domain.subject, { domain: args.domain });
  const text = `${interpolate(copy.domain.text, { domain: args.domain, projectName: args.projectName, failure: args.failure })}${args.actionUrl ? `\n${interpolate(copy.domain.fix, { actionUrl: args.actionUrl })}` : ''}`;
  const actionUrl = args.actionUrl ? emailUrl(args.actionUrl) : null;
  const html = layout(
    subject,
    `<p>${interpolate(copy.domain.intro, { domain: escapeHtml(args.domain), projectName: escapeHtml(args.projectName) })}</p><p>${escapeHtml(args.failure)}</p>${actionUrl ? `<p><a href="${actionUrl}">${copy.domain.review}</a></p>` : ''}`,
  );
  return { subject, html, text };
}

export function renderStripeRestrictionEmail(args: {
  projectName: string;
  restriction: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.stripe.subject, { projectName: args.projectName });
  const text = interpolate(copy.stripe.text, {
    projectName: args.projectName,
    restriction: args.restriction,
  });
  const html = layout(
    subject,
    `<p>${interpolate(copy.stripe.intro, { projectName: escapeHtml(args.projectName) })}</p><p>${escapeHtml(args.restriction)}</p>`,
  );
  return { subject, html, text };
}

export function renderProjectReviewEmail(args: {
  projectName: string;
  status: 'approved' | 'rejected' | 'action_required';
  detail?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const status = copy.review.statuses[args.status];
  const subject = interpolate(copy.review.subject, {
    status: status.label,
    projectName: args.projectName,
  });
  const text = `${interpolate(status.text, { projectName: args.projectName })}${args.detail ? ` ${args.detail}` : ''}`;
  const html = layout(
    subject,
    `<p>${interpolate(status.text, { projectName: `<strong>${escapeHtml(args.projectName)}</strong>` })}</p>${args.detail ? `<p>${escapeHtml(args.detail)}</p>` : ''}`,
  );
  return { subject, html, text };
}

export function renderSecurityChangeEmail(args: {
  projectName: string;
  change: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = interpolate(copy.securityChange.subject, { projectName: args.projectName });
  const text = interpolate(copy.securityChange.text, {
    projectName: args.projectName,
    change: args.change,
  });
  const html = layout(
    subject,
    `<p>${interpolate(copy.securityChange.intro, { projectName: escapeHtml(args.projectName) })}</p><p>${escapeHtml(args.change)}</p>`,
  );
  return { subject, html, text };
}
