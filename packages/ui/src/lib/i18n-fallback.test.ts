import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, messages } from './i18n.js';

const allowedIdenticalValues = new Set([
  // Product and technical names that stay unchanged across locales.
  'Discord',
  'API',
  'CSV',
  'CSS',
  'GBP',
  'GitHub',
  'Google',
  'HTML',
  'ID',
  'JSON',
  'OTP',
  'PeerTube',
  'Stripe',
  'URL',
  'UTC',
  'Vimeo',
  'Webhooks',
  'YouTube',
  'oss.tips',
  'oss.tips admin',
  // These words are established cognates in supported locales.
  'Date',
  'Status',
]);
const allowedIdenticalEntries = new Set([
  // Reviewed German and Romance-language cognates/technical loanwords.
  'de:nav.system',
  'de:sidebar.team',
  'de:sidebar.domains',
  'de:sidebar.audit',
  'de:editor.link',
  'fr:nav.menu',
  'fr:footer.documentation',
  'fr:common.options',
  'fr:common.menu',
  'fr:sidebar.exports',
  'fr:sidebar.documentation',
  'fr:sidebar.audit',
  'fr:editor.visibilityPublic',
  'fr:editor.source',
  'fr:editor.codeFallback',
  'pt-BR:nav.menu',
  'pt-BR:common.menu',
  'pt-BR:editor.link',
]);
const allowedDataKeys = new Set([
  'editor.embedPlaceholder',
  'public.docs.events',
  'public.explore.placeholder',
]);

function hasAlphabeticCopy(value: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(value.replace(/\{[^}]+\}/g, ' '));
}

describe('i18n catalogue quality', () => {
  it('treats short alphabetic labels as copy', () => {
    expect(hasAlphabeticCopy('Payment received')).toBe(true);
    expect(hasAlphabeticCopy('No projects')).toBe(true);
    expect(hasAlphabeticCopy('{count}')).toBe(false);
  });

  it('does not leave English fallback copy in translated catalogues', () => {
    const english = messages[DEFAULT_LOCALE];
    const fallbacks: string[] = [];

    for (const currentLocale of LOCALES) {
      if (currentLocale === DEFAULT_LOCALE) continue;
      for (const [key, value] of Object.entries(messages[currentLocale])) {
        const source = english[key as keyof typeof english];
        if (
          value !== source ||
          allowedIdenticalValues.has(value) ||
          allowedIdenticalEntries.has(`${currentLocale}:${key}`) ||
          allowedDataKeys.has(key) ||
          /^(?:https?:\/\/|www\.)\S+$/.test(value) ||
          !hasAlphabeticCopy(value)
        )
          continue;
        fallbacks.push(`${currentLocale}:${key} = ${value}`);
      }
    }

    expect(fallbacks).toEqual([]);
  });

  it('keeps supporter and backer visibility labels distinct', () => {
    for (const currentLocale of LOCALES) {
      expect(messages[currentLocale]['project.postEditor.supporter']).not.toBe(
        messages[currentLocale]['project.postEditor.backer'],
      );
      expect(messages[currentLocale]['project.status.supporter']).not.toBe(
        messages[currentLocale]['project.status.backer'],
      );
    }
  });
});
