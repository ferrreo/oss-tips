import { sql, type Kysely } from 'kysely';

/** Store responsive image metadata separately so variants inherit asset scope. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE object_asset
      ADD COLUMN reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0)
  `.execute(db);

  await sql`
    CREATE TABLE object_asset_variant (
      id uuid PRIMARY KEY,
      object_asset_id uuid NOT NULL REFERENCES object_asset(id) ON DELETE CASCADE,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      variant_name text NOT NULL CHECK (variant_name IN ('sm', 'md', 'lg')),
      visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
      storage_key text NOT NULL,
      content_type text NOT NULL,
      byte_size bigint NOT NULL CHECK (byte_size > 0),
      width integer NOT NULL CHECK (width > 0),
      height integer NOT NULL CHECK (height > 0),
      checksum text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (object_asset_id, variant_name)
    )
  `.execute(db);

  await sql`
    CREATE INDEX object_asset_variant_project_idx
      ON object_asset_variant (project_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS object_asset_variant_project_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS object_asset_variant`.execute(db);
  await sql`ALTER TABLE object_asset DROP COLUMN IF EXISTS reserved_bytes`.execute(db);
}
