import IntlMessageFormat from 'intl-messageformat';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  ACCOUNT_PREFERENCE_CHANGE_EVENT,
  directionForLocale,
  detectLocale,
  formatCadence,
  formatCurrency,
  formatDate,
  formatNumber,
  formatSidebarLabel,
  isLocale,
  messages,
  persistLocale,
  readPersistedLocale,
  resolveLocale,
  t,
  setLocale,
} from './i18n.js';

describe('i18n', () => {
  it('keeps every supported locale on the source message key set', () => {
    const sourceKeys = Object.keys(messages[DEFAULT_LOCALE]).sort();
    for (const currentLocale of LOCALES) {
      expect(Object.keys(messages[currentLocale]).sort()).toEqual(sourceKeys);
    }
  });

  it('compiles every locale catalogue as ICU message syntax', () => {
    for (const currentLocale of LOCALES) {
      for (const [key, message] of Object.entries(messages[currentLocale])) {
        expect(
          () => new IntlMessageFormat(message, currentLocale),
          `${currentLocale}:${key}`,
        ).not.toThrow();
      }
    }
  });

  it('prefers a saved locale and falls back from language tags', () => {
    expect(detectLocale({ saved: 'fr', languages: ['de'] })).toBe('fr');
    expect(detectLocale({ languages: ['pt-PT', 'en-US'] })).toBe('pt-BR');
    expect(detectLocale({ languages: ['ja-JP'] })).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('EN-us')).toBe('en-GB');
    expect(isLocale('en-GB')).toBe(true);
    expect(isLocale('en-US')).toBe(false);
    expect(resolveLocale('not-a-locale')).toBe(DEFAULT_LOCALE);
  });

  it('persists canonical locale choices without reading storage during SSR', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    persistLocale('de');
    expect(readPersistedLocale()).toBe('de');
    values.set('oss-tips-locale', 'en-US');
    expect(readPersistedLocale()).toBe('en-GB');

    vi.unstubAllGlobals();
  });

  it('announces user locale changes for account synchronisation', () => {
    const events: Event[] = [];
    vi.stubGlobal('window', { dispatchEvent: (event: Event) => events.push(event) });

    setLocale('de', { persist: false });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(ACCOUNT_PREFERENCE_CHANGE_EVENT);
    expect((events[0] as CustomEvent).detail).toEqual({ locale: 'de' });

    setLocale(DEFAULT_LOCALE, { persist: false, syncAccount: false });
    vi.unstubAllGlobals();
  });

  it('formats ICU plural messages in the selected locale', () => {
    expect(t('home.projectStats', { count: 1, amount: '£2.00' }, 'en-GB')).toContain('1 supporter');
    expect(t('home.projectStats', { count: 2, amount: '£2.00' }, 'en-GB')).toContain(
      '2 supporters',
    );
    expect(t('home.projectStats', { count: 2, amount: '2,00 €' }, 'de')).toContain(
      '2 Unterstützer',
    );
  });

  it('formats numbers, currencies, and dates with locale data', () => {
    expect(formatNumber(1234.5, 'de')).toBe('1.234,5');
    expect(formatCurrency(12345, 'GBP', 'en-GB')).toBe('£123.45');
    expect(formatCurrency(12345, 'EUR', 'de')).toContain('123,45');
    expect(formatDate('2026-08-29T12:00:00Z', 'en-GB')).toBe('29 Aug 2026');
  });

  it('localises shared enum labels without translating project-authored text', () => {
    expect(formatCadence('monthly', 'de')).toBe('Monatlich');
    expect(formatSidebarLabel('Overview', 'fr')).toBe('Vue d’ensemble');
    expect(formatSidebarLabel('My project', 'fr')).toBe('My project');
  });

  it('exposes direction for future RTL locale support', () => {
    expect(directionForLocale('en-GB')).toBe('ltr');
    expect(directionForLocale('ar')).toBe('rtl');
    expect(directionForLocale('he-IL')).toBe('rtl');
  });
});
