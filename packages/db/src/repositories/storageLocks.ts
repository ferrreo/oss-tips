import { sql, type QueryExecutorProvider } from 'kysely';

/** Serialize object deletion and content-addressed upload completion by key. */
export async function lockStorageObjectKeys(
  executor: QueryExecutorProvider,
  keys: readonly string[],
): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`.execute(executor);
  }
}
