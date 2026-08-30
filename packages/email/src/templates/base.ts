import { emailCopy } from '../i18n.js';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function layout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">${body}</body></html>`;
}

export function moneyLine(
  projectAmount: string,
  currency: string,
  platformFees: string,
  locale?: string | null,
): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error('Currency must be a 3-letter code');
  const copy = emailCopy(locale);
  return `${copy.money.projectAmount}: ${projectAmount} ${normalizedCurrency} · ${copy.money.projectFee}: ${platformFees} ${normalizedCurrency}`;
}

export function emailUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Email links must be absolute HTTP(S) URLs');
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    throw new Error('Email links must be absolute HTTP(S) URLs');
  }
  return escapeHtml(url.toString());
}

export function excerpt(value: string, maxLength = 240): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
