import { layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderThankYouReplyEmail(args: {
  projectName: string;
  messagePreview: string;
  threadUrl: string;
}): RenderedEmail {
  const subject = `${args.projectName} replied to your message`;
  const text = `${args.projectName} replied: ${args.messagePreview}\nRead: ${args.threadUrl}`;
  const html = layout(
    subject,
    `<p><strong>${args.projectName}</strong> replied to your message:</p><blockquote>${args.messagePreview}</blockquote><p><a href="${args.threadUrl}">View thread</a></p>`,
  );
  return { subject, html, text };
}
