export const LOCALES = ['en-GB', 'de', 'fr', 'es', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-GB';
export const LOCALE_STORAGE_KEY = 'oss-tips-locale';
