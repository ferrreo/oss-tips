import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

const noStore = { headers: { 'cache-control': 'no-store' } };

export const GET: RequestHandler = async () => {
  if (!hasDatabaseUrl()) {
    return json(
      { status: 'not_ready', service: '@oss-tips/web', checks: { database: 'unconfigured' } },
      { ...noStore, status: 503 },
    );
  }

  try {
    await getDb().selectFrom('project').select('id').limit(1).execute();
    return json({ status: 'ready', service: '@oss-tips/web', checks: { database: 'ok' } }, noStore);
  } catch {
    return json(
      { status: 'not_ready', service: '@oss-tips/web', checks: { database: 'unavailable' } },
      { ...noStore, status: 503 },
    );
  }
};
