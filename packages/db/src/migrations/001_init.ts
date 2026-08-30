import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  // Auth
  await sql`
    CREATE TABLE "user" (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified boolean NOT NULL DEFAULT false,
      image text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE session (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE account (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      issuer text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at timestamptz,
      refresh_token_expires_at timestamptz,
      scope text,
      password text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (issuer, account_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE verification (
      id uuid PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE passkey (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      name text,
      credential_id text NOT NULL UNIQUE,
      public_key text NOT NULL,
      counter integer NOT NULL DEFAULT 0,
      device_type text NOT NULL,
      backed_up boolean NOT NULL DEFAULT false,
      transports text,
      created_at timestamptz NOT NULL DEFAULT now(),
      aaguid text,
      last_used_at timestamptz
    )
  `.execute(db);

  await sql`
    CREATE TABLE platform_member (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    )
  `.execute(db);

  await sql`
    CREATE TABLE user_security_event (
      id uuid PRIMARY KEY,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      event_type text NOT NULL,
      ip_address text,
      user_agent text,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Organisations and projects
  await sql`
    CREATE TABLE organisation (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE organisation_member (
      id uuid PRIMARY KEY,
      organisation_id uuid NOT NULL REFERENCES organisation(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organisation_id, user_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE project (
      id uuid PRIMARY KEY,
      organisation_id uuid NOT NULL REFERENCES organisation(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'draft',
      description text,
      default_currency text NOT NULL DEFAULT 'gbp',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_member (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, user_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_repository (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      provider text NOT NULL,
      external_id text NOT NULL,
      url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, provider, external_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_claim (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      email text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_contact (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_feature_mode (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL UNIQUE REFERENCES project(id) ON DELETE CASCADE,
      mode text NOT NULL,
      effective_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_review (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      reviewer_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      status text NOT NULL,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_status_history (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      from_status text,
      to_status text NOT NULL,
      reason text,
      changed_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Stripe / payments
  await sql`
    CREATE TABLE stripe_connected_account (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL UNIQUE REFERENCES project(id) ON DELETE CASCADE,
      stripe_account_id text NOT NULL UNIQUE,
      charges_enabled boolean NOT NULL DEFAULT false,
      payouts_enabled boolean NOT NULL DEFAULT false,
      capabilities jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE stripe_capability_snapshot (
      id uuid PRIMARY KEY,
      connected_account_id uuid NOT NULL REFERENCES stripe_connected_account(id) ON DELETE CASCADE,
      capability text NOT NULL,
      status text NOT NULL,
      snapshot_at timestamptz NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE tier (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL,
      description text,
      rank integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      one_off_duration text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, slug)
    )
  `.execute(db);

  await sql`
    CREATE TABLE tier_price (
      id uuid PRIMARY KEY,
      tier_id uuid NOT NULL REFERENCES tier(id) ON DELETE CASCADE,
      currency text NOT NULL,
      amount_minor bigint NOT NULL,
      cadence text NOT NULL,
      stripe_price_binding_id uuid,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE stripe_product_binding (
      id uuid PRIMARY KEY,
      tier_id uuid NOT NULL REFERENCES tier(id) ON DELETE CASCADE,
      stripe_product_id text NOT NULL,
      stripe_account_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tier_id, stripe_account_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE stripe_price_binding (
      id uuid PRIMARY KEY,
      tier_price_id uuid NOT NULL REFERENCES tier_price(id) ON DELETE CASCADE,
      stripe_price_id text NOT NULL,
      stripe_account_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tier_price_id, stripe_account_id)
    )
  `.execute(db);

  await sql`
    ALTER TABLE tier_price
      ADD CONSTRAINT tier_price_stripe_price_binding_fk
      FOREIGN KEY (stripe_price_binding_id) REFERENCES stripe_price_binding(id) ON DELETE SET NULL
  `.execute(db);

  await sql`
    CREATE TABLE stripe_customer_binding (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      stripe_customer_id text NOT NULL,
      stripe_account_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, user_id, stripe_account_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE stripe_event (
      id uuid PRIMARY KEY,
      stripe_event_id text NOT NULL UNIQUE,
      stripe_account_id text,
      event_type text NOT NULL,
      api_version text,
      payload jsonb NOT NULL,
      processed_at timestamptz,
      process_error text,
      received_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE payment (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      stripe_account_id text NOT NULL,
      stripe_payment_intent_id text UNIQUE,
      stripe_charge_id text,
      currency text NOT NULL,
      exponent integer NOT NULL DEFAULT 2,
      customer_charge_minor bigint NOT NULL,
      project_amount_minor bigint NOT NULL,
      platform_tip_minor bigint NOT NULL DEFAULT 0,
      oss_project_fee_minor bigint NOT NULL DEFAULT 0,
      stripe_application_fee_minor bigint NOT NULL DEFAULT 0,
      status text NOT NULL,
      cadence text NOT NULL,
      feature_mode text NOT NULL,
      settled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE payment_allocation (
      id uuid PRIMARY KEY,
      payment_id uuid NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
      kind text NOT NULL,
      amount_minor bigint NOT NULL,
      currency text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE refund (
      id uuid PRIMARY KEY,
      payment_id uuid NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
      stripe_refund_id text NOT NULL UNIQUE,
      amount_minor bigint NOT NULL,
      application_fee_refund_minor bigint NOT NULL DEFAULT 0,
      currency text NOT NULL,
      status text NOT NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE payment_dispute (
      id uuid PRIMARY KEY,
      payment_id uuid NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
      stripe_dispute_id text NOT NULL UNIQUE,
      status text NOT NULL,
      amount_minor bigint NOT NULL,
      currency text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE subscription (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      tier_id uuid NOT NULL REFERENCES tier(id) ON DELETE RESTRICT,
      stripe_subscription_id text NOT NULL UNIQUE,
      stripe_account_id text NOT NULL,
      status text NOT NULL,
      current_period_end timestamptz,
      grace_ends_at timestamptz,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE subscription_period (
      id uuid PRIMARY KEY,
      subscription_id uuid NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
      period_start timestamptz NOT NULL,
      period_end timestamptz NOT NULL,
      payment_id uuid REFERENCES payment(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE provider_balance_transaction (
      id uuid PRIMARY KEY,
      stripe_account_id text NOT NULL,
      stripe_balance_transaction_id text NOT NULL UNIQUE,
      currency text NOT NULL,
      amount_minor bigint NOT NULL,
      fee_minor bigint NOT NULL DEFAULT 0,
      net_minor bigint NOT NULL,
      type text NOT NULL,
      source_id text,
      available_on timestamptz,
      raw jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE reconciliation_run (
      id uuid PRIMARY KEY,
      stripe_account_id text NOT NULL,
      currency text NOT NULL,
      period_start date NOT NULL,
      period_end date NOT NULL,
      status text NOT NULL,
      started_at timestamptz NOT NULL,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE reconciliation_difference (
      id uuid PRIMARY KEY,
      reconciliation_run_id uuid NOT NULL REFERENCES reconciliation_run(id) ON DELETE CASCADE,
      classification text NOT NULL,
      provider_object_id text,
      expected_minor bigint,
      actual_minor bigint,
      currency text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE checkout_intent (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      stripe_checkout_session_id text,
      currency text NOT NULL,
      project_amount_minor bigint NOT NULL,
      platform_tip_minor bigint NOT NULL DEFAULT 0,
      tier_id uuid REFERENCES tier(id) ON DELETE SET NULL,
      cadence text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Content
  await sql`
    CREATE TABLE tier_reward (
      id uuid PRIMARY KEY,
      tier_id uuid NOT NULL REFERENCES tier(id) ON DELETE CASCADE,
      reward_type text NOT NULL,
      label text NOT NULL,
      description text,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE entitlement (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      tier_id uuid REFERENCES tier(id) ON DELETE SET NULL,
      payment_id uuid REFERENCES payment(id) ON DELETE SET NULL,
      subscription_id uuid REFERENCES subscription(id) ON DELETE SET NULL,
      kind text NOT NULL,
      tier_rank integer NOT NULL DEFAULT 0,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz,
      revoked_at timestamptz,
      transition_key text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE post (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      title text NOT NULL,
      slug text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, slug)
    )
  `.execute(db);

  await sql`
    CREATE TABLE post_revision (
      id uuid PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      revision_number integer NOT NULL,
      body_markdown text NOT NULL,
      editor_json jsonb,
      created_by uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (post_id, revision_number)
    )
  `.execute(db);

  await sql`
    CREATE TABLE post_visibility_rule (
      id uuid PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      rule_kind text NOT NULL,
      minimum_tier_rank integer,
      selected_tier_ids jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE object_asset (
      id uuid PRIMARY KEY,
      project_id uuid REFERENCES project(id) ON DELETE SET NULL,
      purpose text NOT NULL,
      visibility text NOT NULL,
      storage_key text NOT NULL,
      content_type text NOT NULL,
      byte_size bigint NOT NULL,
      checksum text,
      soft_deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE post_attachment (
      id uuid PRIMARY KEY,
      post_revision_id uuid NOT NULL REFERENCES post_revision(id) ON DELETE CASCADE,
      object_asset_id uuid NOT NULL REFERENCES object_asset(id) ON DELETE RESTRICT,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE supporter_public_profile (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      display_name text,
      show_amount boolean NOT NULL DEFAULT false,
      show_name boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, project_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE supporter_message_thread (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      supporter_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      payment_id uuid REFERENCES payment(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE supporter_message (
      id uuid PRIMARY KEY,
      thread_id uuid NOT NULL REFERENCES supporter_message_thread(id) ON DELETE CASCADE,
      author_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      author_name text,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_goal (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      goal_type text NOT NULL,
      target_minor bigint,
      target_count integer,
      currency text,
      title text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Integrations
  await sql`
    CREATE TABLE discord_connection (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      discord_user_id text NOT NULL,
      access_token_encrypted text,
      refresh_token_encrypted text,
      scopes text[] NOT NULL DEFAULT '{}',
      connected_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE discord_guild (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      discord_guild_id text NOT NULL,
      guild_name text,
      bot_installed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, discord_guild_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE discord_role_mapping (
      id uuid PRIMARY KEY,
      discord_guild_id uuid NOT NULL REFERENCES discord_guild(id) ON DELETE CASCADE,
      tier_id uuid NOT NULL REFERENCES tier(id) ON DELETE CASCADE,
      discord_role_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (discord_guild_id, tier_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE discord_role_assignment (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      discord_guild_id uuid NOT NULL REFERENCES discord_guild(id) ON DELETE CASCADE,
      discord_role_id text NOT NULL,
      entitlement_id uuid REFERENCES entitlement(id) ON DELETE SET NULL,
      status text NOT NULL,
      last_synced_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE api_key (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      name text NOT NULL,
      key_hash text NOT NULL,
      key_prefix text NOT NULL,
      scopes text[] NOT NULL DEFAULT '{}',
      last_used_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
    )
  `.execute(db);

  await sql`
    CREATE TABLE webhook_endpoint (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      url text NOT NULL,
      secret_hash text NOT NULL,
      events text[] NOT NULL DEFAULT '{}',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE webhook_delivery (
      id uuid PRIMARY KEY,
      webhook_endpoint_id uuid NOT NULL REFERENCES webhook_endpoint(id) ON DELETE CASCADE,
      event_id text NOT NULL UNIQUE,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      status text NOT NULL,
      attempt_count integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz,
      last_response_status integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE custom_domain (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      hostname text NOT NULL UNIQUE,
      status text NOT NULL,
      ssl_status text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE email_delivery (
      id uuid PRIMARY KEY,
      to_address text NOT NULL,
      template text NOT NULL,
      status text NOT NULL,
      provider_id text,
      metadata jsonb NOT NULL DEFAULT '{}',
      sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Platform operations
  await sql`
    CREATE TABLE audit_event (
      id uuid PRIMARY KEY,
      actor_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      actor_type text NOT NULL,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id uuid,
      project_id uuid REFERENCES project(id) ON DELETE SET NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      ip_address text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE admin_case (
      id uuid PRIMARY KEY,
      kind text NOT NULL,
      status text NOT NULL,
      subject_type text NOT NULL,
      subject_id uuid NOT NULL,
      assigned_to uuid REFERENCES "user"(id) ON DELETE SET NULL,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    )
  `.execute(db);

  await sql`
    CREATE TABLE abuse_report (
      id uuid PRIMARY KEY,
      reporter_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
      project_id uuid REFERENCES project(id) ON DELETE SET NULL,
      resource_type text NOT NULL,
      resource_id uuid,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE job (
      id uuid PRIMARY KEY,
      queue text NOT NULL,
      kind text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}',
      status text NOT NULL DEFAULT 'pending',
      attempt_count integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 5,
      run_at timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      locked_by text,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE INDEX job_queue_status_run_at_idx ON job (queue, status, run_at)
  `.execute(db);

  await sql`
    CREATE TABLE outbox_event (
      id uuid PRIMARY KEY,
      aggregate_type text NOT NULL,
      aggregate_id uuid NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE INDEX outbox_event_unpublished_idx ON outbox_event (published_at) WHERE published_at IS NULL
  `.execute(db);

  await sql`
    CREATE TABLE ledger_account_binding (
      id uuid PRIMARY KEY,
      account_code integer NOT NULL,
      scope_kind text NOT NULL,
      scope_id text NOT NULL,
      currency text NOT NULL,
      tigerbeetle_account_id text NOT NULL UNIQUE,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (account_code, scope_kind, scope_id, currency)
    )
  `.execute(db);

  await sql`
    CREATE TABLE ledger_posting_intent (
      id uuid PRIMARY KEY,
      stripe_event_id text,
      stripe_account_id text,
      payment_id uuid REFERENCES payment(id) ON DELETE SET NULL,
      posting_kind text NOT NULL,
      posting_version integer NOT NULL DEFAULT 1,
      semantic_key text NOT NULL UNIQUE,
      payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE ledger_posting_result (
      id uuid PRIMARY KEY,
      intent_id uuid NOT NULL UNIQUE REFERENCES ledger_posting_intent(id) ON DELETE CASCADE,
      tigerbeetle_transfer_ids text[] NOT NULL DEFAULT '{}',
      status text NOT NULL,
      error text,
      posted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE metric_event_hourly (
      id uuid PRIMARY KEY,
      project_id uuid REFERENCES project(id) ON DELETE CASCADE,
      metric_name text NOT NULL,
      hour_start timestamptz NOT NULL,
      value bigint NOT NULL DEFAULT 0,
      dimensions jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE project_metric_daily (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      day date NOT NULL,
      currency text,
      metric_name text NOT NULL,
      value_minor bigint,
      value_count bigint,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, day, metric_name, currency)
    )
  `.execute(db);

  await sql`
    CREATE TABLE platform_metric_daily (
      id uuid PRIMARY KEY,
      day date NOT NULL,
      metric_name text NOT NULL,
      value_minor bigint,
      value_count bigint,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (day, metric_name)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const tables = [
    'platform_metric_daily',
    'project_metric_daily',
    'metric_event_hourly',
    'ledger_posting_result',
    'ledger_posting_intent',
    'ledger_account_binding',
    'outbox_event',
    'job',
    'abuse_report',
    'admin_case',
    'audit_event',
    'email_delivery',
    'custom_domain',
    'webhook_delivery',
    'webhook_endpoint',
    'api_key',
    'discord_role_assignment',
    'discord_role_mapping',
    'discord_guild',
    'discord_connection',
    'project_goal',
    'supporter_message',
    'supporter_message_thread',
    'supporter_public_profile',
    'post_attachment',
    'object_asset',
    'post_visibility_rule',
    'post_revision',
    'post',
    'entitlement',
    'tier_reward',
    'checkout_intent',
    'reconciliation_difference',
    'reconciliation_run',
    'provider_balance_transaction',
    'subscription_period',
    'subscription',
    'payment_dispute',
    'refund',
    'payment_allocation',
    'payment',
    'stripe_event',
    'stripe_customer_binding',
    'stripe_price_binding',
    'stripe_product_binding',
    'tier_price',
    'tier',
    'stripe_capability_snapshot',
    'stripe_connected_account',
    'project_status_history',
    'project_review',
    'project_feature_mode',
    'project_contact',
    'project_claim',
    'project_repository',
    'project_member',
    'project',
    'organisation_member',
    'organisation',
    'user_security_event',
    'platform_member',
    'passkey',
    'verification',
    'account',
    'session',
    '"user"',
  ];

  for (const table of tables) {
    await sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`).execute(db);
  }
}
