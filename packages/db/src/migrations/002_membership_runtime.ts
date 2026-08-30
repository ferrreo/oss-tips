import { sql, type Kysely } from 'kysely';

/** Add immutable subscription snapshots and invoice identity for Slice C. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE subscription
      ADD COLUMN project_amount_minor bigint,
      ADD COLUMN platform_tip_minor bigint,
      ADD COLUMN currency text,
      ADD COLUMN feature_mode text,
      ADD COLUMN cadence text,
      ADD COLUMN last_event_created bigint NOT NULL DEFAULT 0,
      ADD COLUMN last_event_id text NOT NULL DEFAULT ''
  `.execute(db);

  await sql`
    ALTER TABLE subscription_period
      ADD COLUMN stripe_invoice_id text
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX subscription_period_stripe_invoice_id_unique
      ON subscription_period (stripe_invoice_id)
      WHERE stripe_invoice_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS subscription_period_stripe_invoice_id_unique
  `.execute(db);
  await sql`
    ALTER TABLE subscription_period DROP COLUMN stripe_invoice_id
  `.execute(db);
  await sql`
    ALTER TABLE subscription
      DROP COLUMN last_event_id,
      DROP COLUMN last_event_created,
      DROP COLUMN cadence,
      DROP COLUMN feature_mode,
      DROP COLUMN currency,
      DROP COLUMN platform_tip_minor,
      DROP COLUMN project_amount_minor
  `.execute(db);
}
