import { sql, type Kysely } from 'kysely';

/** Keep each provider message identity attached to one delivery. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_provider_id_unique
      ON email_delivery (provider_id)
      WHERE provider_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS email_delivery_provider_id_unique`.execute(db);
}
