import { sql, type Kysely } from 'kysely';

/** Coarse public analytics with retry dedupe; no IP, user-agent, or fingerprint columns. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS metric_event_dedupe (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      event_key_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, event_key_hash)
    )
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS metric_event_hourly_dimensions_unique
      ON metric_event_hourly (project_id, metric_name, hour_start, dimensions)
      WHERE project_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS metric_event_dedupe_created_idx
      ON metric_event_dedupe (created_at)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS metric_event_dedupe_created_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS metric_event_hourly_dimensions_unique`.execute(db);
  await sql`DROP TABLE IF EXISTS metric_event_dedupe`.execute(db);
}
