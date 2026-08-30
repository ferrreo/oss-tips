import { sql, type Kysely } from 'kysely';

/** Persist Cloudflare identity, DNS proof and the 5% mode grace window. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE custom_domain
      ADD COLUMN IF NOT EXISTS provider_id text,
      ADD COLUMN IF NOT EXISTS validation_method text NOT NULL DEFAULT 'txt',
      ADD COLUMN IF NOT EXISTS validation_name text,
      ADD COLUMN IF NOT EXISTS validation_value text,
      ADD COLUMN IF NOT EXISTS cname_target text,
      ADD COLUMN IF NOT EXISTS grace_until timestamptz,
      ADD COLUMN IF NOT EXISTS last_error text,
      ADD COLUMN IF NOT EXISTS retry_at timestamptz,
      ADD COLUMN IF NOT EXISTS canonical_enabled boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    ALTER TABLE custom_domain
      DROP CONSTRAINT IF EXISTS custom_domain_hostname_key
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_domain_hostname_active_unique
      ON custom_domain (hostname)
      WHERE status <> 'removed'
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_domain_one_per_project
      ON custom_domain (project_id)
      WHERE status <> 'removed'
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_domain_provider_id_unique
      ON custom_domain (provider_id)
      WHERE provider_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS custom_domain_provider_id_unique`.execute(db);
  await sql`DROP INDEX IF EXISTS custom_domain_one_per_project`.execute(db);
  await sql`DROP INDEX IF EXISTS custom_domain_hostname_active_unique`.execute(db);
  await sql`
    ALTER TABLE custom_domain
      ADD CONSTRAINT custom_domain_hostname_key UNIQUE (hostname)
  `.execute(db);
  await sql`
    ALTER TABLE custom_domain
      DROP COLUMN IF EXISTS canonical_enabled,
      DROP COLUMN IF EXISTS retry_at,
      DROP COLUMN IF EXISTS last_error,
      DROP COLUMN IF EXISTS grace_until,
      DROP COLUMN IF EXISTS validation_value,
      DROP COLUMN IF EXISTS validation_name,
      DROP COLUMN IF EXISTS validation_method,
      DROP COLUMN IF EXISTS cname_target,
      DROP COLUMN IF EXISTS provider_id
  `.execute(db);
}
