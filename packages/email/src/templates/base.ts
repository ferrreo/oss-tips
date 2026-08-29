function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function layout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">${body}</body></html>`;
}

export function moneyLine(projectAmount: string, currency: string, platformFees: string): string {
  return `Project amount: ${projectAmount} ${currency.toUpperCase()} · oss.tips fees/tip: ${platformFees} ${currency.toUpperCase()}`;
}
