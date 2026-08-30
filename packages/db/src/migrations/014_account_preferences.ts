import { sql, type Kysely } from 'kysely';

/** Persist user display and email-delivery preferences alongside the account. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE "user"
      ADD COLUMN theme_preference text NOT NULL DEFAULT 'system'
        CHECK (theme_preference IN ('system', 'light', 'dark')),
      ADD COLUMN locale text NOT NULL DEFAULT 'en-GB'
        CHECK (locale IN ('en-GB', 'de', 'fr', 'es', 'pt-BR'))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE "user"
      DROP COLUMN locale,
      DROP COLUMN theme_preference
  `.execute(db);
}
