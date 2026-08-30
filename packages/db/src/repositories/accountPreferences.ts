import type { Db } from '../client.js';
import {
  ACCOUNT_LOCALES,
  ACCOUNT_THEME_PREFERENCES,
  type AccountLocale,
  type AccountThemePreference,
} from '../types.js';

export type AccountPreferences = {
  themePreference: AccountThemePreference;
  locale: AccountLocale;
};

export type AccountPreferencesPatch = Partial<AccountPreferences>;

export function isAccountThemePreference(value: unknown): value is AccountThemePreference {
  return (
    typeof value === 'string' && ACCOUNT_THEME_PREFERENCES.includes(value as AccountThemePreference)
  );
}

export function isAccountLocale(value: unknown): value is AccountLocale {
  return typeof value === 'string' && ACCOUNT_LOCALES.includes(value as AccountLocale);
}

function accountPreferencesFromRow(row: {
  theme_preference: string;
  locale: string;
}): AccountPreferences {
  if (!isAccountThemePreference(row.theme_preference) || !isAccountLocale(row.locale)) {
    throw new Error('Invalid account preference data');
  }
  return { themePreference: row.theme_preference, locale: row.locale };
}

export async function getAccountPreferences(
  db: Db,
  userId: string,
): Promise<AccountPreferences | null> {
  const row = await db
    .selectFrom('user')
    .select(['theme_preference', 'locale'])
    .where('id', '=', userId)
    .executeTakeFirst();
  return row ? accountPreferencesFromRow(row) : null;
}

export async function updateAccountPreferences(
  db: Db,
  userId: string,
  patch: AccountPreferencesPatch,
): Promise<AccountPreferences | null> {
  if (patch.themePreference === undefined && patch.locale === undefined) {
    return getAccountPreferences(db, userId);
  }
  const updated = await db
    .updateTable('user')
    .set({
      ...(patch.themePreference === undefined ? {} : { theme_preference: patch.themePreference }),
      ...(patch.locale === undefined ? {} : { locale: patch.locale }),
      updated_at: new Date(),
    })
    .where('id', '=', userId)
    .returning(['theme_preference', 'locale'])
    .executeTakeFirst();
  return updated ? accountPreferencesFromRow(updated) : null;
}
