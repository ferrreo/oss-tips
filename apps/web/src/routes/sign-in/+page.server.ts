import { getConfiguredOAuthProviders } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
  oauthProviders: getConfiguredOAuthProviders().map((id) => ({ id, label: '' })),
});
