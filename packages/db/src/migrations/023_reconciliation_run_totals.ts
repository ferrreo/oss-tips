import { sql, type Kysely } from 'kysely';

/** Persist reconciliation totals so admin reads do not fan out to Stripe or TigerBeetle. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE reconciliation_run
      ADD COLUMN IF NOT EXISTS provider_net_minor bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ledger_net_minor bigint NOT NULL DEFAULT 0
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE reconciliation_run
      DROP COLUMN IF EXISTS provider_net_minor,
      DROP COLUMN IF EXISTS ledger_net_minor
  `.execute(db);
}
