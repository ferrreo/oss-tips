import { createDb, type Db } from '@oss-tips/db';

let cached: Db | null = null;

/** Shared Kysely instance for the SvelteKit process. */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  cached = createDb(url);
  return cached;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
