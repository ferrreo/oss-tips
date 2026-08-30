import { sql, type Kysely } from 'kysely';

/** Durable token buckets for authenticated API principals and sensitive routes. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE api_rate_limit (
      id uuid PRIMARY KEY,
      key_hash text NOT NULL,
      route_class text NOT NULL,
      available_tokens double precision NOT NULL CHECK (available_tokens >= 0),
      last_refill_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (key_hash, route_class)
    )
  `.execute(db);

  await sql`
    CREATE INDEX api_rate_limit_updated_idx
      ON api_rate_limit (updated_at)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS api_rate_limit_updated_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS api_rate_limit`.execute(db);
}
