import { layout } from './base.js';
import type { RenderedEmail } from '../types.js';

export function renderOtpEmail(args: { code: string; expiresMinutes: number }): RenderedEmail {
  const subject = 'Your oss.tips sign-in code';
  const text = `Your sign-in code is ${args.code}. It expires in ${args.expiresMinutes} minutes.`;
  const html = layout(
    subject,
    `<p>Your sign-in code is <strong>${args.code}</strong>.</p><p>It expires in ${args.expiresMinutes} minutes.</p>`,
  );
  return { subject, html, text };
}
