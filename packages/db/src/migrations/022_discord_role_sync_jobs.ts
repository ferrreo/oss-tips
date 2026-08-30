import { sql, type Kysely } from 'kysely';

/** Allow multiple roles per tier and coalesce concurrent Discord role work. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE discord_role_mapping
      DROP CONSTRAINT IF EXISTS discord_role_mapping_discord_guild_id_tier_id_key
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS discord_role_mapping_guild_tier_role_unique
      ON discord_role_mapping (discord_guild_id, tier_id, discord_role_id)
  `.execute(db);

  await sql`
    ALTER TABLE job ADD COLUMN IF NOT EXISTS dedupe_key text
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS job_discord_role_sync_active_unique
      ON job (dedupe_key)
      WHERE kind = 'discord.role_sync'
        AND dedupe_key IS NOT NULL
        AND status IN ('pending', 'processing')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS job_discord_role_sync_active_unique`.execute(db);
  await sql`ALTER TABLE job DROP COLUMN IF EXISTS dedupe_key`.execute(db);
  await sql`DROP INDEX IF EXISTS discord_role_mapping_guild_tier_role_unique`.execute(db);
  await sql`
    ALTER TABLE discord_role_mapping
      ADD CONSTRAINT discord_role_mapping_discord_guild_id_tier_id_key
      UNIQUE (discord_guild_id, tier_id)
  `.execute(db);
}
