import { sql, type Kysely } from 'kysely';

/** Scheduling and explicit supporter notifications for posts. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE post
      ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
      ADD COLUMN IF NOT EXISTS notify_supporters boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS post_scheduled_publish_idx
      ON post (scheduled_at)
      WHERE status = 'scheduled' AND scheduled_at IS NOT NULL
  `.execute(db);

  await sql`
    ALTER TABLE email_delivery
      ADD COLUMN IF NOT EXISTS dedupe_key text
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_dedupe_key_unique
      ON email_delivery (dedupe_key)
      WHERE dedupe_key IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS email_delivery_dedupe_key_unique`.execute(db);
  await sql`ALTER TABLE email_delivery DROP COLUMN IF EXISTS dedupe_key`.execute(db);
  await sql`DROP INDEX IF EXISTS post_scheduled_publish_idx`.execute(db);
  await sql`ALTER TABLE post DROP COLUMN IF EXISTS notify_supporters, DROP COLUMN IF EXISTS scheduled_at`.execute(
    db,
  );
}
