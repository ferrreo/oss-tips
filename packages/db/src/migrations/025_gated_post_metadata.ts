import { sql, type Kysely } from 'kysely';

/** Keep gated post metadata private unless a project opts in explicitly. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE project
      ADD COLUMN IF NOT EXISTS public_show_gated_post_metadata boolean NOT NULL DEFAULT false
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE project
      DROP COLUMN IF EXISTS public_show_gated_post_metadata
  `.execute(db);
}
