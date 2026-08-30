import { escapeHtml, layout } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderSecurityEventEmail(args: {
  event: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const subject = copy.security.subject;
  const text = `${interpolate(copy.security.textEvent, { event: args.event })}${args.ip ? interpolate(copy.security.textIp, { ip: args.ip }) : ''}${args.userAgent ? interpolate(copy.security.textDevice, { userAgent: args.userAgent }) : ''}`;
  const html = layout(
    subject,
    `<p>${copy.security.intro}</p><p>${copy.security.eventLabel}: ${escapeHtml(args.event)}</p>${args.ip ? `<p>${copy.security.ipLabel}: ${escapeHtml(args.ip)}</p>` : ''}${args.userAgent ? `<p>${copy.security.deviceLabel}: ${escapeHtml(args.userAgent)}</p>` : ''}`,
  );
  return { subject, html, text };
}
