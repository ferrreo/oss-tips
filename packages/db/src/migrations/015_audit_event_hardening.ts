import { sql, type Kysely } from 'kysely';

/** Move audit records to the documented append-only, redacted shape. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE audit_event
      RENAME COLUMN actor_user_id TO actor_id
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      RENAME COLUMN created_at TO occurred_at
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      ADD COLUMN session_id uuid,
      ADD COLUMN reason text,
      ADD COLUMN ip_hash text,
      ADD COLUMN before_hash text,
      ADD COLUMN after_hash text,
      ADD COLUMN correlation_id text
  `.execute(db);

  // Audit rows retain actor/session identifiers after their source records are
  // removed. Foreign-key cascades would mutate an append-only event.
  await sql`
    ALTER TABLE audit_event
      DROP CONSTRAINT IF EXISTS audit_event_actor_user_id_fkey
  `.execute(db);

  // Do not carry unrestricted historical JSON or raw addresses into the
  // redacted schema. Existing event identity and timing remain intact.
  await sql`
    ALTER TABLE audit_event
      ADD COLUMN metadata_redacted jsonb NOT NULL DEFAULT '{}',
      DROP COLUMN metadata,
      DROP COLUMN ip_address
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS audit_event_immutable ON audit_event
  `.execute(db);

  await sql`
    UPDATE audit_event
      SET correlation_id = id::text
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      ALTER COLUMN correlation_id SET NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX audit_event_occurred_idx
      ON audit_event (occurred_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX audit_event_project_occurred_idx
      ON audit_event (project_id, occurred_at DESC)
  `.execute(db);

  await sql`
    CREATE TRIGGER audit_event_immutable
      BEFORE UPDATE OR DELETE ON audit_event
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_event_mutation()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS audit_event_project_occurred_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS audit_event_occurred_idx`.execute(db);

  await sql`
    ALTER TABLE audit_event
      DROP COLUMN correlation_id,
      DROP COLUMN after_hash,
      DROP COLUMN before_hash,
      DROP COLUMN ip_hash,
      DROP COLUMN reason,
      DROP COLUMN session_id
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      RENAME COLUMN metadata_redacted TO metadata
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      ADD COLUMN ip_address text
  `.execute(db);

  // The down migration is only a local rollback path. Raw IP values are
  // intentionally not restored.
  await sql`
    ALTER TABLE audit_event
      RENAME COLUMN occurred_at TO created_at
  `.execute(db);

  await sql`
    ALTER TABLE audit_event
      RENAME COLUMN actor_id TO actor_user_id
  `.execute(db);
}
