import { sql, type Kysely } from 'kysely';

/** Durable OTP send limits shared by every web process. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE otp_send_rate_limit (
      id uuid PRIMARY KEY,
      scope text NOT NULL CHECK (scope IN ('email', 'ip')),
      key_hash text NOT NULL,
      window_started_at timestamptz NOT NULL,
      send_count integer NOT NULL DEFAULT 0 CHECK (send_count >= 0),
      last_sent_at timestamptz,
      cooldown_level integer NOT NULL DEFAULT 0 CHECK (cooldown_level >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (scope, key_hash)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS otp_send_rate_limit`.execute(db);
}
