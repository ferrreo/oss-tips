import { sql, type Kysely } from 'kysely';

/** Store supporter-provided public identity and message choices with payment. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE payment
      ADD COLUMN IF NOT EXISTS public_display_name text,
      ADD COLUMN IF NOT EXISTS public_message text
  `.execute(db);
  await sql`
    ALTER TABLE supporter_public_profile
      ADD COLUMN IF NOT EXISTS show_message boolean NOT NULL DEFAULT false
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE payment
      DROP COLUMN IF EXISTS public_display_name,
      DROP COLUMN IF EXISTS public_message
  `.execute(db);
  await sql`
    ALTER TABLE supporter_public_profile
      DROP COLUMN IF EXISTS show_message
  `.execute(db);
}
