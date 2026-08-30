import { sql, type Kysely } from 'kysely';

/** Keep generated project exports discoverable until their short retention window ends. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE object_asset
      ADD COLUMN IF NOT EXISTS expires_at timestamptz
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS object_asset_export_expiry_idx
      ON object_asset (expires_at)
      WHERE purpose = 'export' AND expires_at IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS object_asset_export_expiry_idx`.execute(db);
  await sql`
    ALTER TABLE object_asset
      DROP COLUMN IF EXISTS expires_at
  `.execute(db);
}
