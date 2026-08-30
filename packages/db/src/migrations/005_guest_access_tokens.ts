import { sql, type Kysely } from 'kysely';

/** Short-lived, single-use links for guests who cannot use a session yet. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE payment
      ADD COLUMN IF NOT EXISTS receipt_email text,
      ADD COLUMN IF NOT EXISTS public_show_name boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS public_show_amount boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS public_show_message boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    ALTER TABLE checkout_intent
      ADD COLUMN IF NOT EXISTS public_show_name boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS public_show_amount boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS public_show_message boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    ALTER TABLE supporter_message
      ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS guest_access_token (
      id uuid PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('claim', 'reply')),
      token_hash text NOT NULL UNIQUE,
      payment_id uuid REFERENCES payment(id) ON DELETE CASCADE,
      thread_id uuid REFERENCES supporter_message_thread(id) ON DELETE CASCADE,
      email_hash text NOT NULL,
      attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (
        (kind = 'claim' AND payment_id IS NOT NULL AND thread_id IS NULL)
        OR (kind = 'reply' AND payment_id IS NULL AND thread_id IS NOT NULL)
      )
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS guest_access_token_payment_idx
      ON guest_access_token (payment_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS guest_access_token_thread_idx
      ON guest_access_token (thread_id, created_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS guest_access_token CASCADE`.execute(db);
  await sql`
    ALTER TABLE supporter_message
      DROP COLUMN IF EXISTS is_internal
  `.execute(db);
  await sql`
    ALTER TABLE checkout_intent
      DROP COLUMN IF EXISTS public_show_name,
      DROP COLUMN IF EXISTS public_show_amount,
      DROP COLUMN IF EXISTS public_show_message
  `.execute(db);
  await sql`
    ALTER TABLE payment
      DROP COLUMN IF EXISTS receipt_email,
      DROP COLUMN IF EXISTS public_show_name,
      DROP COLUMN IF EXISTS public_show_amount,
      DROP COLUMN IF EXISTS public_show_message
  `.execute(db);
}
