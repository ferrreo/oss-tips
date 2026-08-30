import { sql, type Kysely } from 'kysely';

/** Persist provider correction identities and webhook cursors. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE payment
      ADD COLUMN IF NOT EXISTS stripe_application_fee_id text
  `.execute(db);

  await sql`
    ALTER TABLE refund
      ADD COLUMN IF NOT EXISTS idempotency_key text,
      ADD COLUMN IF NOT EXISTS stripe_application_fee_refund_id text
  `.execute(db);

  await sql`
    ALTER TABLE payment_dispute
      ADD COLUMN IF NOT EXISTS last_event_created bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_event_id text NOT NULL DEFAULT ''
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS payment_application_fee_id_unique
      ON payment (stripe_application_fee_id)
      WHERE stripe_application_fee_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS refund_payment_idempotency_unique
      ON refund (payment_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS refund_application_fee_refund_id_unique
      ON refund (stripe_application_fee_refund_id)
      WHERE stripe_application_fee_refund_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payment_dispute_payment_idx
      ON payment_dispute (payment_id, last_event_created DESC, last_event_id DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS payment_dispute_payment_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS refund_application_fee_refund_id_unique`.execute(db);
  await sql`DROP INDEX IF EXISTS refund_payment_idempotency_unique`.execute(db);
  await sql`DROP INDEX IF EXISTS payment_application_fee_id_unique`.execute(db);
  await sql`
    ALTER TABLE payment_dispute
      DROP COLUMN IF EXISTS last_event_id,
      DROP COLUMN IF EXISTS last_event_created
  `.execute(db);
  await sql`
    ALTER TABLE refund
      DROP COLUMN IF EXISTS stripe_application_fee_refund_id,
      DROP COLUMN IF EXISTS idempotency_key
  `.execute(db);
  await sql`
    ALTER TABLE payment
      DROP COLUMN IF EXISTS stripe_application_fee_id
  `.execute(db);
}
