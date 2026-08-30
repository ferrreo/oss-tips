import { sql, type Kysely } from 'kysely';

/** Queue sign-in OTP delivery in the same transaction as Better Auth's verification row. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION enqueue_sign_in_otp_job()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.identifier LIKE 'sign-in-otp-%'
        AND NEW.value ~ '^otp:v1:[0-9a-f]{64}:0$' THEN
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
          'otp',
          'email.notification',
          jsonb_build_object(
            'notification', 'auth-otp',
            'verification_id', NEW.id
          ),
          'pending',
          0,
          5,
          now(),
          NULL,
          NULL,
          NULL
        );
      END IF;
      RETURN NEW;
    END;
    $$
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS verification_sign_in_otp_job ON verification
  `.execute(db);

  await sql`
    CREATE TRIGGER verification_sign_in_otp_job
    AFTER INSERT ON verification
    FOR EACH ROW
    EXECUTE FUNCTION enqueue_sign_in_otp_job()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS verification_sign_in_otp_job ON verification
  `.execute(db);
  await sql`DROP FUNCTION IF EXISTS enqueue_sign_in_otp_job()`.execute(db);
}
