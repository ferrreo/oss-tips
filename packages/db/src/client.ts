import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';

const { Pool } = pg;

export type Db = Kysely<Database>;

export function createDb(connectionString: string): Db {
  const pool = new Pool({
    connectionString,
    max: 8,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

export async function destroyDb(db: Db): Promise<void> {
  await db.destroy();
}
