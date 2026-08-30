import { emailCopy, interpolate, type ApiKeyChange, type WebhookChange } from '../i18n.js';
import { escapeHtml, layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export type ApiKeyChangeEmailArgs = {
  projectName: string;
  keyName?: string | undefined;
  locale?: string | null;
} & ({ action: ApiKeyChange } | { change: ApiKeyChange });

export function renderApiKeyChangeEmail(args: ApiKeyChangeEmailArgs): RenderedEmail {
  const copy = emailCopy(args.locale);
  const actionKey = 'action' in args ? args.action : args.change;
  const actionCopy = copy.apiKey.actions[actionKey];
  const subject = interpolate(copy.apiKey.subject, { projectName: args.projectName });
  const text = `${interpolate(actionCopy.text, { projectName: args.projectName })}${args.keyName ? `\n${interpolate(copy.apiKey.name, { name: args.keyName })}` : ''}`;
  const html = layout(
    subject,
    `<p>${interpolate(actionCopy.intro, { projectName: escapeHtml(args.projectName) })}</p>${args.keyName ? `<p>${interpolate(copy.apiKey.name, { name: escapeHtml(args.keyName) })}</p>` : ''}`,
  );
  return { subject, html, text };
}

export type WebhookChangeEmailArgs = {
  projectName: string;
  endpoint?: string | undefined;
  locale?: string | null;
} & ({ action: WebhookChange } | { change: WebhookChange });

export function renderWebhookChangeEmail(args: WebhookChangeEmailArgs): RenderedEmail {
  const copy = emailCopy(args.locale);
  const actionKey = 'action' in args ? args.action : args.change;
  const actionCopy = copy.webhook.actions[actionKey];
  const subject = interpolate(copy.webhook.subject, { projectName: args.projectName });
  const text = `${interpolate(actionCopy.text, { projectName: args.projectName })}${args.endpoint ? `\n${interpolate(copy.webhook.endpoint, { endpoint: args.endpoint })}` : ''}`;
  const html = layout(
    subject,
    `<p>${interpolate(actionCopy.intro, { projectName: escapeHtml(args.projectName) })}</p>${args.endpoint ? `<p>${interpolate(copy.webhook.endpoint, { endpoint: escapeHtml(args.endpoint) })}</p>` : ''}`,
  );
  return { subject, html, text };
}
