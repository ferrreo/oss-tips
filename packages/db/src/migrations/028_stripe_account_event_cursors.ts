import { sql, type Kysely } from 'kysely';

/** Prevent stale Stripe Connect account events from regressing stored state. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE stripe_connected_account
      ADD COLUMN IF NOT EXISTS last_event_created bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_event_id text NOT NULL DEFAULT ''
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE stripe_connected_account
      DROP COLUMN IF EXISTS last_event_id,
      DROP COLUMN IF EXISTS last_event_created
  `.execute(db);
}
