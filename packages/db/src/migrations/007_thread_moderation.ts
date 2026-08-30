import { sql, type Kysely } from 'kysely';

/** Durable message throttles and payment-bound thread moderation state. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE abuse_report
      ADD COLUMN reporter_key_hash text
  `.execute(db);

  await sql`
    CREATE TABLE message_rate_limit (
      id uuid PRIMARY KEY,
      scope text NOT NULL CHECK (scope IN ('thread', 'user', 'project')),
      key_hash text NOT NULL,
      window_started_at timestamptz NOT NULL,
      message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (scope, key_hash)
    )
  `.execute(db);

  await sql`
    CREATE TABLE message_block (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      thread_id uuid NOT NULL REFERENCES supporter_message_thread(id) ON DELETE CASCADE,
      blocker_key_hash text NOT NULL,
      blocked_key_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (blocker_key_hash <> blocked_key_hash),
      UNIQUE (project_id, thread_id, blocker_key_hash, blocked_key_hash)
    )
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX supporter_message_thread_payment_unique
      ON supporter_message_thread (payment_id)
      WHERE payment_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX abuse_report_actor_resource_unique
      ON abuse_report (resource_type, resource_id, reporter_key_hash)
      WHERE reporter_key_hash IS NOT NULL AND resource_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE FUNCTION require_settled_supporter_thread_payment()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF NEW.payment_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM payment
        WHERE payment.id = NEW.payment_id
          AND payment.status = 'succeeded'
      ) THEN
        RAISE EXCEPTION 'supporter message threads require a settled payment';
      END IF;
      RETURN NEW;
    END;
    $function$
  `.execute(db);

  await sql`
    CREATE TRIGGER supporter_message_thread_settled_payment
      BEFORE INSERT ON supporter_message_thread
      FOR EACH ROW
      EXECUTE FUNCTION require_settled_supporter_thread_payment()
  `.execute(db);

  await sql`
    CREATE FUNCTION prevent_audit_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      RAISE EXCEPTION 'audit events are immutable';
    END;
    $function$
  `.execute(db);

  await sql`
    CREATE TRIGGER audit_event_immutable
      BEFORE UPDATE OR DELETE ON audit_event
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_event_mutation()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS audit_event_immutable ON audit_event`.execute(db);
  await sql`DROP FUNCTION IF EXISTS prevent_audit_event_mutation()`.execute(db);
  await sql`
    DROP TRIGGER IF EXISTS supporter_message_thread_settled_payment
      ON supporter_message_thread
  `.execute(db);
  await sql`DROP FUNCTION IF EXISTS require_settled_supporter_thread_payment()`.execute(db);
  await sql`DROP INDEX IF EXISTS abuse_report_actor_resource_unique`.execute(db);
  await sql`DROP INDEX IF EXISTS supporter_message_thread_payment_unique`.execute(db);
  await sql`DROP TABLE IF EXISTS message_block`.execute(db);
  await sql`DROP TABLE IF EXISTS message_rate_limit`.execute(db);
  await sql`
    ALTER TABLE abuse_report
      DROP COLUMN IF EXISTS reporter_key_hash
  `.execute(db);
}
