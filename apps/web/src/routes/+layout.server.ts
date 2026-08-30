import { error } from '@sveltejs/kit';
import { getAccountPreferences } from '@oss-tips/db';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.session) return { accountPreferences: null };
  if (!hasDatabaseUrl()) {
    if (process.env.NODE_ENV === 'production') {
      throw error(503, 'Account preferences are unavailable');
    }
    return { accountPreferences: null };
  }

  try {
    const preferences = await getAccountPreferences(getDb(), locals.session.user.id);
    if (!preferences) throw new Error('Authenticated user was not found');
    return { accountPreferences: preferences };
  } catch (cause) {
    console.error('[account] Failed to load account preferences', cause);
    throw error(503, 'Account preferences are unavailable');
  }
};
