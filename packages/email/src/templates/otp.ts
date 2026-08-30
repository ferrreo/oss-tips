import { escapeHtml, layout } from './base.js';
import { emailCopy, interpolate, resolveEmailLocale } from '../i18n.js';
import type { RenderedEmail } from '../types.js';

export function renderOtpEmail(args: {
  code: string;
  expiresMinutes: number;
  purpose?: 'sign-in' | 'support-email';
  locale?: string | null;
}): RenderedEmail {
  if (!/^\d{6}$/.test(args.code)) throw new Error('OTP code must contain six digits');
  if (!Number.isInteger(args.expiresMinutes) || args.expiresMinutes <= 0) {
    throw new Error('OTP expiry must be a positive number of minutes');
  }
  const copy = emailCopy(args.locale);
  const locale = resolveEmailLocale(args.locale);
  const minutes = new Intl.NumberFormat(locale).format(args.expiresMinutes);
  const otpCopy = args.purpose === 'support-email' ? copy.otp.support : copy.otp;
  const subject = otpCopy.subject;
  const text = interpolate(otpCopy.text, {
    code: args.code,
    minutes,
  });
  const html = layout(
    subject,
    `<p>${interpolate(otpCopy.htmlCode, { code: escapeHtml(args.code), minutes })}</p><p>${interpolate(otpCopy.htmlExpiry, { code: escapeHtml(args.code), minutes })}</p>`,
  );
  return { subject, html, text };
}
