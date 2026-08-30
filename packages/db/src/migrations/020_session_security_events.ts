import { sql, type Kysely } from 'kysely';

/** Keep sign-in security events and notifications in the session transaction. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION enqueue_session_security_event()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      event_id uuid := gen_random_uuid();
    BEGIN
      INSERT INTO user_security_event (
        id,
        user_id,
        event_type,
        ip_address,
        user_agent,
        metadata
      ) VALUES (
        event_id,
        NEW.user_id,
        'auth.sign_in',
        NEW.ip_address,
        NEW.user_agent,
        jsonb_build_object('source', 'better-auth', 'session_id', NEW.id)
      );

      INSERT INTO job (
        id,
        queue,
        kind,
        payload,
        status,
        attempt_count,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        last_error
      ) VALUES (
        gen_random_uuid(),
        'default',
        'email.notification',
        jsonb_build_object(
          'notification', 'security-event',
          'user_id', NEW.user_id,
          'event_id', event_id,
          'event', 'sign-in'
        ),
        'pending',
        0,
        5,
        now(),
        NULL,
        NULL,
        NULL
      );

      RETURN NEW;
    END;
    $$
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS session_security_event_job ON session
  `.execute(db);

  await sql`
    CREATE TRIGGER session_security_event_job
    AFTER INSERT ON session
    FOR EACH ROW
    EXECUTE FUNCTION enqueue_session_security_event()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS session_security_event_job ON session
  `.execute(db);
  await sql`DROP FUNCTION IF EXISTS enqueue_session_security_event()`.execute(db);
}
