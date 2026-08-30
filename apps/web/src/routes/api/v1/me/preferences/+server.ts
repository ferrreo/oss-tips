import { AccountPreferencesPatchSchema, AccountPreferencesSchema } from '@oss-tips/api-contracts';
import { getAccountPreferences, updateAccountPreferences } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';
import { readJson, requireSession } from '../../../api-utils';

function responsePayload(preferences: Awaited<ReturnType<typeof getAccountPreferences>>) {
  return preferences
    ? AccountPreferencesSchema.parse({
        theme: preferences.themePreference,
        locale: preferences.locale,
      })
    : null;
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const preferences = await getAccountPreferences(getDb(), session.userId);
  if (!preferences) return problem(404, 'User not found');
  return json(responsePayload(preferences), { headers: { 'cache-control': 'private, no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const patch = await readJson(event.request, AccountPreferencesPatchSchema);
  if (patch instanceof Response) return patch;
  const preferences = await updateAccountPreferences(getDb(), session.userId, {
    ...(patch.theme === undefined ? {} : { themePreference: patch.theme }),
    ...(patch.locale === undefined ? {} : { locale: patch.locale }),
  });
  if (!preferences) return problem(404, 'User not found');
  return json(responsePayload(preferences), { headers: { 'cache-control': 'private, no-store' } });
};
