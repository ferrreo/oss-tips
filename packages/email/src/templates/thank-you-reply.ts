import { emailUrl, escapeHtml, excerpt, layout } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderThankYouReplyEmail(args: {
  projectName: string;
  messagePreview: string;
  threadUrl: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const preview = excerpt(args.messagePreview);
  const subject = interpolate(copy.reply.subject, { projectName: args.projectName });
  const text = interpolate(copy.reply.text, {
    projectName: args.projectName,
    preview,
    threadUrl: args.threadUrl,
  });
  const threadUrl = emailUrl(args.threadUrl);
  const html = layout(
    subject,
    `<p>${interpolate(copy.reply.intro, { projectName: escapeHtml(args.projectName) })}</p><blockquote>${escapeHtml(preview)}</blockquote><p><a href="${threadUrl}">${copy.reply.view}</a></p>`,
  );
  return { subject, html, text };
}
