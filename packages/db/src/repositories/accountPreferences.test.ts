import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import {
  getAccountPreferences,
  isAccountLocale,
  isAccountThemePreference,
  updateAccountPreferences,
} from './accountPreferences.js';

type PreferenceRow = { theme_preference: string; locale: string };

function fakeDb(row: PreferenceRow | undefined) {
  let values: Record<string, unknown> | undefined;
  const selectBuilder = {
    select: () => selectBuilder,
    where: () => selectBuilder,
    executeTakeFirst: async () => row,
  };
  const updateBuilder = {
    set: (next: Record<string, unknown>) => {
      values = next;
      return updateBuilder;
    },
    where: () => updateBuilder,
    returning: () => updateBuilder,
    executeTakeFirst: async () => (row ? { ...row, ...values } : undefined),
  };
  return {
    db: {
      selectFrom: () => selectBuilder,
      updateTable: () => updateBuilder,
    } as unknown as Db,
    updated: () => values,
  };
}

describe('account preference validation', () => {
  it('accepts supported theme and locale values only', () => {
    expect(isAccountThemePreference('system')).toBe(true);
    expect(isAccountThemePreference('dark')).toBe(true);
    expect(isAccountThemePreference('auto')).toBe(false);
    expect(isAccountLocale('pt-BR')).toBe(true);
    expect(isAccountLocale('en-US')).toBe(false);
    expect(isAccountLocale(null)).toBe(false);
  });

  it('reads and updates both account preferences together', async () => {
    const fixture = fakeDb({ theme_preference: 'system', locale: 'en-GB' });
    await expect(getAccountPreferences(fixture.db, 'user-1')).resolves.toEqual({
      themePreference: 'system',
      locale: 'en-GB',
    });
    await expect(
      updateAccountPreferences(fixture.db, 'user-1', {
        themePreference: 'dark',
        locale: 'de',
      }),
    ).resolves.toEqual({ themePreference: 'dark', locale: 'de' });
    expect(fixture.updated()).toMatchObject({ theme_preference: 'dark', locale: 'de' });
  });

  it('rejects invalid persisted values instead of defaulting silently', async () => {
    const fixture = fakeDb({ theme_preference: 'auto', locale: 'en-GB' });
    await expect(getAccountPreferences(fixture.db, 'user-1')).rejects.toThrow(
      'Invalid account preference data',
    );
  });
});
