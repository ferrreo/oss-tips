import { sql, type Kysely } from 'kysely';

/** Project identity, onboarding, tier metadata, goals, and explicit team capabilities. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE project
      ADD COLUMN IF NOT EXISTS website_url text,
      ADD COLUMN IF NOT EXISTS support_email text,
      ADD COLUMN IF NOT EXISTS support_email_verified_at timestamptz,
      ADD COLUMN IF NOT EXISTS open_source_declared boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS open_source_license text,
      ADD COLUMN IF NOT EXISTS min_support_minor bigint,
      ADD COLUMN IF NOT EXISTS max_support_minor bigint,
      ADD COLUMN IF NOT EXISTS public_show_supporters boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS public_show_goal boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS public_show_stats boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS logo_asset_id uuid REFERENCES object_asset(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS banner_asset_id uuid REFERENCES object_asset(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS discovery_ecosystems text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS discovery_languages text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS discovery_tags text[] NOT NULL DEFAULT '{}'
  `.execute(db);

  await sql`
    ALTER TABLE project
      ADD CONSTRAINT project_support_limits_valid
      CHECK (
        (min_support_minor IS NULL OR min_support_minor >= 0)
        AND (max_support_minor IS NULL OR max_support_minor > 0)
        AND (min_support_minor IS NULL OR max_support_minor IS NULL OR min_support_minor <= max_support_minor)
      )
  `
    .execute(db)
    .catch(() => undefined);

  await sql`
    ALTER TABLE project_repository
      ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS verified_at timestamptz
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS project_repository_claim_unique
      ON project_repository (provider, external_id)
  `.execute(db);

  await sql`
    ALTER TABLE project_claim
      ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'manual_email',
      ADD COLUMN IF NOT EXISTS proof_reference text,
      ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
      ADD COLUMN IF NOT EXISTS failure_reason text
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS project_claim_project_status_idx
      ON project_claim (project_id, status, created_at DESC)
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS project_claim_active_unique
      ON project_claim (project_id)
      WHERE status IN ('pending', 'manual_review')
  `.execute(db);

  await sql`
    ALTER TABLE tier
      ADD COLUMN IF NOT EXISTS icon text,
      ADD COLUMN IF NOT EXISTS member_cap integer,
      ADD COLUMN IF NOT EXISTS minimum_visibility text NOT NULL DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS badge text,
      ADD COLUMN IF NOT EXISTS discord_role_ids text[] NOT NULL DEFAULT '{}'
  `.execute(db);

  await sql`
    ALTER TABLE tier
      ADD CONSTRAINT tier_member_cap_valid CHECK (member_cap IS NULL OR member_cap > 0)
  `
    .execute(db)
    .catch(() => undefined);

  await sql`
    ALTER TABLE project_goal
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
      ADD COLUMN IF NOT EXISTS deadline timestamptz,
      ADD COLUMN IF NOT EXISTS basis text
  `.execute(db);

  await sql`
    ALTER TABLE project_member
      ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}'
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS project_team_invite (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL,
      capabilities text[] NOT NULL DEFAULT '{}',
      invited_by uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'pending',
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
    )
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS project_team_invite_pending_unique
      ON project_team_invite (project_id, email)
      WHERE status = 'pending'
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS project_team_invite_project_idx
      ON project_team_invite (project_id, created_at DESC)
  `.execute(db);

  // Existing roles retain their documented defaults; explicit arrays then make
  // future custom-role changes fail closed instead of inheriting new powers.
  await sql`
    UPDATE project_member
    SET capabilities = CASE role
      WHEN 'owner' THEN ARRAY[
        'project.transfer_ownership', 'project.delete', 'project.connect_stripe',
        'project.change_fee_mode', 'project.manage_domain', 'project.manage_team',
        'project.refund', 'project.export_finance', 'project.manage_tiers',
        'project.manage_goals', 'project.publish_posts', 'project.reply_supporters',
        'project.discord_mappings', 'project.view_analytics', 'project.manage_webhooks',
        'project.manage_api_keys', 'project.view_payments', 'project.publish_project'
      ]::text[]
      WHEN 'admin' THEN ARRAY[
        'project.change_fee_mode', 'project.manage_domain', 'project.manage_team',
        'project.export_finance', 'project.manage_tiers', 'project.manage_goals',
        'project.publish_posts', 'project.reply_supporters', 'project.discord_mappings',
        'project.view_analytics', 'project.manage_webhooks', 'project.manage_api_keys',
        'project.view_payments', 'project.publish_project'
      ]::text[]
      WHEN 'finance' THEN ARRAY[
        'project.refund', 'project.export_finance', 'project.view_analytics',
        'project.view_payments'
      ]::text[]
      WHEN 'editor' THEN ARRAY['project.publish_posts', 'project.view_analytics']::text[]
      WHEN 'community' THEN ARRAY[
        'project.reply_supporters', 'project.discord_mappings', 'project.view_analytics'
      ]::text[]
      WHEN 'analyst' THEN ARRAY['project.view_analytics', 'project.view_payments']::text[]
      ELSE ARRAY[]::text[]
    END
    WHERE capabilities = '{}'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS project_team_invite_project_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS project_team_invite_pending_unique`.execute(db);
  await sql`DROP TABLE IF EXISTS project_team_invite`.execute(db);
  await sql`ALTER TABLE project_member DROP COLUMN IF EXISTS capabilities`.execute(db);
  await sql`
    ALTER TABLE project_goal
      DROP COLUMN IF EXISTS basis,
      DROP COLUMN IF EXISTS deadline,
      DROP COLUMN IF EXISTS status
  `.execute(db);
  await sql`ALTER TABLE tier DROP COLUMN IF EXISTS discord_role_ids, DROP COLUMN IF EXISTS badge, DROP COLUMN IF EXISTS minimum_visibility, DROP COLUMN IF EXISTS member_cap, DROP COLUMN IF EXISTS icon`.execute(
    db,
  );
  await sql`DROP INDEX IF EXISTS project_claim_project_status_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS project_claim_active_unique`.execute(db);
  await sql`ALTER TABLE project_claim DROP COLUMN IF EXISTS failure_reason, DROP COLUMN IF EXISTS reviewed_at, DROP COLUMN IF EXISTS reviewed_by, DROP COLUMN IF EXISTS proof_reference, DROP COLUMN IF EXISTS method`.execute(
    db,
  );
  await sql`DROP INDEX IF EXISTS project_repository_claim_unique`.execute(db);
  await sql`ALTER TABLE project_repository DROP COLUMN IF EXISTS verified_at, DROP COLUMN IF EXISTS verification_status`.execute(
    db,
  );
  await sql`ALTER TABLE project DROP CONSTRAINT IF EXISTS project_support_limits_valid`.execute(db);
  await sql`
    ALTER TABLE project
      DROP COLUMN IF EXISTS discovery_tags,
      DROP COLUMN IF EXISTS discovery_languages,
      DROP COLUMN IF EXISTS discovery_ecosystems,
      DROP COLUMN IF EXISTS banner_asset_id,
      DROP COLUMN IF EXISTS logo_asset_id,
      DROP COLUMN IF EXISTS public_show_stats,
      DROP COLUMN IF EXISTS public_show_goal,
      DROP COLUMN IF EXISTS public_show_supporters,
      DROP COLUMN IF EXISTS max_support_minor,
      DROP COLUMN IF EXISTS min_support_minor,
      DROP COLUMN IF EXISTS open_source_license,
      DROP COLUMN IF EXISTS open_source_declared,
      DROP COLUMN IF EXISTS support_email_verified_at,
      DROP COLUMN IF EXISTS support_email,
      DROP COLUMN IF EXISTS website_url
  `.execute(db);
}
