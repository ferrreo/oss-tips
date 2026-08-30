import { sql, type Kysely } from 'kysely';

/** Keep retained media out of automated deletion until a hold is released. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE object_asset
      ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE object_asset
      DROP COLUMN IF EXISTS legal_hold
  `.execute(db);
}
