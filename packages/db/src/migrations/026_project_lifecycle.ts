import { sql, type Kysely } from 'kysely';

/** Record logical project closure without deleting financial or audit history. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE project
      ADD COLUMN IF NOT EXISTS closed_at timestamptz
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE project
      DROP COLUMN IF EXISTS closed_at
  `.execute(db);
}
