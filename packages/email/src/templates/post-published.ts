import { emailUrl, escapeHtml, layout } from './base.js';
import { emailCopy, interpolate } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderPostPublishedEmail(args: {
  projectName: string;
  title: string;
  postUrl: string;
  locale?: string | null;
}): RenderedEmail {
  const copy = emailCopy(args.locale);
  const title = escapeHtml(args.title);
  const project = escapeHtml(args.projectName);
  const url = emailUrl(args.postUrl);
  const publishedText = interpolate(copy.post.publishedText, {
    projectName: args.projectName,
    title: args.title,
  });
  const publishedHtml = interpolate(copy.post.published, { projectName: project, title });
  return {
    subject: interpolate(copy.post.subject, { projectName: args.projectName, title: args.title }),
    html: layout(
      copy.post.htmlTitle,
      `<p>${publishedHtml}</p><p><a href="${url}">${copy.post.read}</a></p>`,
    ),
    text: `${publishedText}\n\n${copy.post.read}: ${args.postUrl}`,
  };
}
