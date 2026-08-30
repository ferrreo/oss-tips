import IntlMessageFormat from 'intl-messageformat';
import { currencyExponent } from '@oss-tips/domain/money';
import { get, writable } from 'svelte/store';
import { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, type Locale } from './i18n/locales.js';
import { aboutMessages } from './i18n/messages/about.js';
import { adminMessages } from './i18n/messages/admin.js';
import { authMessages } from './i18n/messages/auth.js';
import { commonMessages } from './i18n/messages/common.js';
import { editorMessages } from './i18n/messages/editor.js';
import { footerMessages } from './i18n/messages/footer.js';
import { homeMessages } from './i18n/messages/home.js';
import { navMessages } from './i18n/messages/nav.js';
import { projectDashboardMessages } from './i18n/messages/project-dashboard.js';
import { publicMessages } from './i18n/messages/public.js';
import { sidebarMessages } from './i18n/messages/sidebar.js';
import { shellsMessages } from './i18n/messages/shells.js';
import { supporterMessages } from './i18n/messages/supporter.js';

export { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY } from './i18n/locales.js';
export type { Locale } from './i18n/locales.js';

const englishMessages = {
  ...navMessages['en-GB'],
  ...footerMessages['en-GB'],
  ...authMessages['en-GB'],
  ...homeMessages['en-GB'],
  ...aboutMessages['en-GB'],
  ...adminMessages['en-GB'],
  ...commonMessages['en-GB'],
  ...sidebarMessages['en-GB'],
  ...editorMessages['en-GB'],
  ...shellsMessages['en-GB'],
  ...projectDashboardMessages['en-GB'],
  ...publicMessages['en-GB'],
  ...supporterMessages['en-GB'],
} as const;

export type MessageKey = keyof typeof englishMessages;
export type AccountThemePreference = 'system' | 'light' | 'dark';
export type AccountPreferenceChange = {
  theme?: AccountThemePreference;
  locale?: Locale;
  source?: 'account';
};
export type MessageValues = Record<
  string,
  string | number | bigint | boolean | Date | null | undefined
>;
type MessageTable = Record<MessageKey, string>;

export const messages: Record<Locale, MessageTable> = {
  'en-GB': {
    ...navMessages['en-GB'],
    ...footerMessages['en-GB'],
    ...authMessages['en-GB'],
    ...homeMessages['en-GB'],
    ...aboutMessages['en-GB'],
    ...adminMessages['en-GB'],
    ...commonMessages['en-GB'],
    ...sidebarMessages['en-GB'],
    ...editorMessages['en-GB'],
    ...shellsMessages['en-GB'],
    ...projectDashboardMessages['en-GB'],
    ...publicMessages['en-GB'],
    ...supporterMessages['en-GB'],
  },
  de: {
    ...navMessages['de'],
    ...footerMessages['de'],
    ...authMessages['de'],
    ...homeMessages['de'],
    ...aboutMessages['de'],
    ...adminMessages['de'],
    ...commonMessages['de'],
    ...sidebarMessages['de'],
    ...editorMessages['de'],
    ...shellsMessages['de'],
    ...projectDashboardMessages['de'],
    ...publicMessages['de'],
    ...supporterMessages['de'],
  },
  fr: {
    ...navMessages['fr'],
    ...footerMessages['fr'],
    ...authMessages['fr'],
    ...homeMessages['fr'],
    ...aboutMessages['fr'],
    ...adminMessages['fr'],
    ...commonMessages['fr'],
    ...sidebarMessages['fr'],
    ...editorMessages['fr'],
    ...shellsMessages['fr'],
    ...projectDashboardMessages['fr'],
    ...publicMessages['fr'],
    ...supporterMessages['fr'],
  },
  es: {
    ...navMessages['es'],
    ...footerMessages['es'],
    ...authMessages['es'],
    ...homeMessages['es'],
    ...aboutMessages['es'],
    ...adminMessages['es'],
    ...commonMessages['es'],
    ...sidebarMessages['es'],
    ...editorMessages['es'],
    ...shellsMessages['es'],
    ...projectDashboardMessages['es'],
    ...publicMessages['es'],
    ...supporterMessages['es'],
  },
  'pt-BR': {
    ...navMessages['pt-BR'],
    ...footerMessages['pt-BR'],
    ...authMessages['pt-BR'],
    ...homeMessages['pt-BR'],
    ...aboutMessages['pt-BR'],
    ...adminMessages['pt-BR'],
    ...commonMessages['pt-BR'],
    ...sidebarMessages['pt-BR'],
    ...editorMessages['pt-BR'],
    ...shellsMessages['pt-BR'],
    ...projectDashboardMessages['pt-BR'],
    ...publicMessages['pt-BR'],
    ...supporterMessages['pt-BR'],
  },
};

export const locale = writable<Locale>(DEFAULT_LOCALE);

const formatterCache = new Map<string, IntlMessageFormat>();

function formatter(key: MessageKey, currentLocale: Locale): IntlMessageFormat {
  const cacheKey = `${currentLocale}:${key}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;
  const created = new IntlMessageFormat(messages[currentLocale][key], currentLocale);
  formatterCache.set(cacheKey, created);
  return created;
}

function asLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  try {
    const canonical = Intl.getCanonicalLocales(value)[0];
    if (!canonical) return null;
    const exact = LOCALES.find((candidate) => candidate.toLowerCase() === canonical.toLowerCase());
    if (exact) return exact;
    const language = canonical.split('-')[0]?.toLowerCase();
    return LOCALES.find((candidate) => candidate.split('-')[0]?.toLowerCase() === language) ?? null;
  } catch {
    return null;
  }
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return asLocale(value) ?? DEFAULT_LOCALE;
}

export function detectLocale(
  options: { saved?: string | null; languages?: readonly string[] } = {},
): Locale {
  const saved = asLocale(options.saved);
  if (saved) return saved;
  for (const candidate of options.languages ?? []) {
    const resolved = asLocale(candidate);
    if (resolved) return resolved;
  }
  return DEFAULT_LOCALE;
}

export function readPersistedLocale(): Locale | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return asLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistLocale(currentLocale: Locale): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export const ACCOUNT_PREFERENCE_CHANGE_EVENT = 'oss-tips:account-preference-change';

export function notifyAccountPreferenceChange(change: AccountPreferenceChange): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AccountPreferenceChange>(ACCOUNT_PREFERENCE_CHANGE_EVENT, { detail: change }),
  );
}

export function directionForLocale(currentLocale: string): 'ltr' | 'rtl' {
  return /^(ar|fa|he|ur)(-|$)/i.test(currentLocale) ? 'rtl' : 'ltr';
}

export function applyLocale(currentLocale: Locale): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = currentLocale;
  root.dir = directionForLocale(currentLocale);
  root.dataset.locale = currentLocale;
}

export function setLocale(
  next: Locale,
  options: { persist?: boolean; syncAccount?: boolean } = {},
): void {
  locale.set(next);
  applyLocale(next);
  if (options.persist !== false) persistLocale(next);
  if (options.syncAccount !== false) notifyAccountPreferenceChange({ locale: next });
}

export function initLocale(): Locale {
  const currentLocale = detectLocale({
    saved: readPersistedLocale(),
    languages: typeof navigator === 'undefined' ? [] : navigator.languages,
  });
  setLocale(currentLocale, { persist: false, syncAccount: false });
  return currentLocale;
}

export function t(
  key: MessageKey,
  values: MessageValues = {},
  currentLocale: Locale = get(locale),
): string {
  const result = formatter(key, currentLocale).format(values);
  return Array.isArray(result) ? result.join('') : String(result);
}

export function createTranslator(currentLocale: Locale = get(locale)) {
  return (key: MessageKey, values?: MessageValues): string => t(key, values, currentLocale);
}

const CADENCE_KEYS: Record<string, MessageKey> = {
  'one-off': 'common.oneOff',
  one_off: 'common.oneOff',
  oneoff: 'common.oneOff',
  monthly: 'common.monthly',
  annual: 'common.annual',
  yearly: 'common.annual',
};

export function formatCadence(value: string, currentLocale: Locale = get(locale)): string {
  const key = CADENCE_KEYS[value];
  return key ? t(key, {}, currentLocale) : value;
}

const SIDEBAR_KEYS: Record<string, MessageKey> = {
  account: 'sidebar.account',
  admin: 'sidebar.admin',
  analytics: 'sidebar.analytics',
  'api keys': 'sidebar.apiKeys',
  audit: 'sidebar.audit',
  cases: 'sidebar.cases',
  discord: 'sidebar.discord',
  directory: 'sidebar.directory',
  domains: 'sidebar.domains',
  entitlements: 'sidebar.entitlements',
  exports: 'sidebar.exports',
  goals: 'sidebar.goals',
  inbox: 'sidebar.inbox',
  memberships: 'sidebar.memberships',
  operations: 'sidebar.operations',
  overview: 'sidebar.overview',
  payments: 'sidebar.payments',
  posts: 'sidebar.posts',
  project: 'sidebar.project',
  reconciliation: 'sidebar.reconciliation',
  review: 'sidebar.review',
  settings: 'sidebar.settings',
  stripe: 'sidebar.stripe',
  supporters: 'sidebar.supporters',
  team: 'sidebar.team',
  webhooks: 'sidebar.webhooks',
  documentation: 'sidebar.documentation',
};

/** Translate platform navigation labels while preserving project-authored labels. */
export function formatSidebarLabel(value: string, currentLocale: Locale = get(locale)): string {
  const key = SIDEBAR_KEYS[value.trim().toLowerCase()];
  return key ? t(key, {}, currentLocale) : value;
}

export function formatNumber(
  value: number,
  currentLocale: Locale = get(locale),
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(currentLocale, options).format(value);
}

export function formatCurrency(
  amountMinor: number | bigint,
  currency: string,
  currentLocale: Locale = get(locale),
): string {
  const code = currency.toUpperCase();
  const exponent = currencyExponent(code);
  const amount = Number(amountMinor) / 10 ** exponent;
  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: code,
  }).format(amount);
}

export function formatDate(
  value: Date | number | string,
  currentLocale: Locale = get(locale),
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(currentLocale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

export const localeNames: Record<Locale, string> = {
  'en-GB': 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
};

export const localeShortNames: Record<Locale, string> = {
  'en-GB': 'EN',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  'pt-BR': 'PT-BR',
};
