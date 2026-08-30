import { sql, type Kysely } from 'kysely';

/** Prevent concurrent finance workers from processing the same Stripe inbox row. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE stripe_event
      ADD COLUMN IF NOT EXISTS processing_at timestamptz,
      ADD COLUMN IF NOT EXISTS processing_by text,
      ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS stripe_event_unprocessed_claim_idx
      ON stripe_event (received_at)
      WHERE processed_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS stripe_event_unprocessed_claim_idx`.execute(db);
  await sql`
    ALTER TABLE stripe_event
      DROP COLUMN IF EXISTS processing_attempts,
      DROP COLUMN IF EXISTS processing_by,
      DROP COLUMN IF EXISTS processing_at
  `.execute(db);
}
