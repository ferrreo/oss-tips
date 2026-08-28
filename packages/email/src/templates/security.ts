import { layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderSecurityEventEmail(args: {
  event: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): RenderedEmail {
  const subject = 'New sign-in to your oss.tips account';
  const text = `Security event: ${args.event}${args.ip ? ` from ${args.ip}` : ''}`;
  const html = layout(
    subject,
    `<p>A new sign-in was detected on your oss.tips account.</p><p>Event: ${args.event}</p>${args.ip ? `<p>IP: ${args.ip}</p>` : ''}`,
  );
  return { subject, html, text };
}
