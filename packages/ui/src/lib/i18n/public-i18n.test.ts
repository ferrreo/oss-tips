import { describe, expect, it } from 'vitest';
import { publicMessages } from './messages/public.js';

const technicalKeys = new Set(['public.docs.events', 'public.explore.placeholder']);

describe('public i18n catalogue', () => {
  it('does not fall back to English for visible copy', () => {
    const english = publicMessages['en-GB'];
    const fallbacks: string[] = [];

    for (const [locale, catalogue] of Object.entries(publicMessages)) {
      if (locale === 'en-GB') continue;
      for (const [key, value] of Object.entries(catalogue)) {
        if (
          value === english[key as keyof typeof english] &&
          !technicalKeys.has(key) &&
          /[A-Za-zÀ-ÿ]/.test(value.replace(/\{[^}]+\}/g, ' '))
        ) {
          fallbacks.push(`${locale}:${key}`);
        }
      }
    }

    expect(fallbacks).toEqual([]);
  });
});
