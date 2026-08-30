import { sql, type Kysely } from 'kysely';

/** Track provider delivery events and durable recipient suppression. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE email_delivery
      ADD COLUMN IF NOT EXISTS updated_at timestamptz
  `.execute(db);

  await sql`
    UPDATE email_delivery
      SET updated_at = created_at
      WHERE updated_at IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE email_delivery
      ALTER COLUMN updated_at SET DEFAULT now(),
      ALTER COLUMN updated_at SET NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_sending_updated_idx
      ON email_delivery (updated_at)
      WHERE status = 'sending'
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS email_delivery_event (
      id uuid PRIMARY KEY,
      provider_event_id text NOT NULL UNIQUE,
      provider_email_id text,
      email_delivery_id uuid REFERENCES email_delivery(id) ON DELETE SET NULL,
      event_type text NOT NULL,
      status text NOT NULL,
      occurred_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_event_email_idx
      ON email_delivery_event (provider_email_id)
      WHERE provider_email_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS email_suppression (
      email_address text PRIMARY KEY,
      reason text NOT NULL,
      provider_event_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS email_suppression`.execute(db);
  await sql`DROP INDEX IF EXISTS email_delivery_event_email_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS email_delivery_event`.execute(db);
  await sql`DROP INDEX IF EXISTS email_delivery_sending_updated_idx`.execute(db);
  await sql`ALTER TABLE email_delivery DROP COLUMN IF EXISTS updated_at`.execute(db);
}
