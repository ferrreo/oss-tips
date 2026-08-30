import { sql, type Kysely } from 'kysely';

/** Keep one durable reconciliation result for each account/currency/day window. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_run_window_unique
      ON reconciliation_run (stripe_account_id, currency, period_start, period_end)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS reconciliation_run_window_unique`.execute(db);
}
