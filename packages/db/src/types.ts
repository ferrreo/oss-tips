import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/** UUID primary keys stored as strings. */
export type Uuid = string;

/** Money amounts in minor units — bigint in app, numeric string in DB. */
export type MoneyMinor = ColumnType<string, string | bigint | number, string | bigint | number>;
export type NullableMoneyMinor = ColumnType<
  string | null,
  string | bigint | number | null,
  string | bigint | number | null
>;

export type Timestamp = Date;

export const ACCOUNT_THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type AccountThemePreference = (typeof ACCOUNT_THEME_PREFERENCES)[number];

export const ACCOUNT_LOCALES = ['en-GB', 'de', 'fr', 'es', 'pt-BR'] as const;
export type AccountLocale = (typeof ACCOUNT_LOCALES)[number];

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type Json = ColumnType<JsonValue, JsonValue, JsonValue>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserTable = {
  id: Uuid;
  name: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  theme_preference: Generated<AccountThemePreference>;
  locale: Generated<AccountLocale>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type SessionTable = {
  id: Uuid;
  user_id: Uuid;
  token: string;
  expires_at: Timestamp;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type AccountTable = {
  id: Uuid;
  user_id: Uuid;
  account_id: string;
  provider_id: string;
  issuer: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: Timestamp | null;
  refresh_token_expires_at: Timestamp | null;
  scope: string | null;
  password: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type VerificationTable = {
  id: Uuid;
  identifier: string;
  value: string;
  expires_at: Timestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PasskeyTable = {
  id: Uuid;
  user_id: Uuid;
  name: string | null;
  credential_id: string;
  public_key: string;
  counter: Generated<number>;
  device_type: string;
  backed_up: Generated<boolean>;
  transports: string | null;
  created_at: Generated<Timestamp>;
  aaguid: string | null;
  last_used_at: Timestamp | null;
};

export type UserSecurityEventTable = {
  id: Uuid;
  user_id: Uuid | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: Generated<Timestamp>;
};

export type PlatformMemberTable = {
  id: Uuid;
  user_id: Uuid;
  role: string;
  created_at: Generated<Timestamp>;
};

/** Shared-store OTP send counters keyed by HMACs, never raw addresses. */
export type OtpSendRateLimitTable = {
  id: Uuid;
  scope: 'email' | 'ip';
  key_hash: string;
  window_started_at: Timestamp;
  send_count: number;
  last_sent_at: Timestamp | null;
  cooldown_level: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

/** Shared token buckets for API principals and sensitive route classes. */
export type ApiRateLimitTable = {
  id: Uuid;
  key_hash: string;
  route_class: string;
  available_tokens: number;
  last_refill_at: Timestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Organisations and projects
// ---------------------------------------------------------------------------

export type OrganisationTable = {
  id: Uuid;
  name: string;
  slug: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type OrganisationMemberTable = {
  id: Uuid;
  organisation_id: Uuid;
  user_id: Uuid;
  role: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectTable = {
  id: Uuid;
  organisation_id: Uuid;
  name: string;
  slug: string;
  status: string;
  closed_at: Generated<Timestamp | null>;
  description: string | null;
  default_currency: string;
  website_url: Generated<string | null>;
  support_email: Generated<string | null>;
  support_email_verified_at: Generated<Timestamp | null>;
  open_source_declared: Generated<boolean>;
  open_source_license: Generated<string | null>;
  min_support_minor: Generated<string | null>;
  max_support_minor: Generated<string | null>;
  public_show_supporters: Generated<boolean>;
  public_show_goal: Generated<boolean>;
  public_show_stats: Generated<boolean>;
  public_show_gated_post_metadata: Generated<boolean>;
  logo_asset_id: Generated<Uuid | null>;
  banner_asset_id: Generated<Uuid | null>;
  discovery_ecosystems: Generated<string[]>;
  discovery_languages: Generated<string[]>;
  discovery_tags: Generated<string[]>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectMemberTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid;
  role: string;
  capabilities: Generated<string[]>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectRepositoryTable = {
  id: Uuid;
  project_id: Uuid;
  provider: string;
  external_id: string;
  url: string;
  verification_status: Generated<string>;
  verified_at: Generated<Timestamp | null>;
  created_at: Generated<Timestamp>;
};

export type ProjectClaimTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  email: string;
  status: string;
  method: Generated<string>;
  proof_reference: Generated<string | null>;
  reviewed_by: Generated<Uuid | null>;
  reviewed_at: Generated<Timestamp | null>;
  failure_reason: Generated<string | null>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectContactTable = {
  id: Uuid;
  project_id: Uuid;
  email: string;
  role: string | null;
  created_at: Generated<Timestamp>;
};

export type ProjectFeatureModeTable = {
  id: Uuid;
  project_id: Uuid;
  mode: string;
  effective_at: Timestamp;
  created_at: Generated<Timestamp>;
};

export type ProjectReviewTable = {
  id: Uuid;
  project_id: Uuid;
  reviewer_id: Uuid | null;
  status: string;
  notes: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectStatusHistoryTable = {
  id: Uuid;
  project_id: Uuid;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_by: Uuid | null;
  created_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Stripe / payments
// ---------------------------------------------------------------------------

export type StripeConnectedAccountTable = {
  id: Uuid;
  project_id: Uuid;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  capabilities: Json;
  /** Stripe event ordering cursor; protects account state from late webhook delivery. */
  last_event_created: Generated<string>;
  last_event_id: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type StripeCapabilitySnapshotTable = {
  id: Uuid;
  connected_account_id: Uuid;
  capability: string;
  status: string;
  snapshot_at: Timestamp;
};

export type StripeCustomerBindingTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  stripe_customer_id: string;
  stripe_account_id: string;
  created_at: Generated<Timestamp>;
};

export type StripeProductBindingTable = {
  id: Uuid;
  tier_id: Uuid;
  stripe_product_id: string;
  stripe_account_id: string;
  created_at: Generated<Timestamp>;
};

export type StripePriceBindingTable = {
  id: Uuid;
  tier_price_id: Uuid;
  stripe_price_id: string;
  stripe_account_id: string;
  created_at: Generated<Timestamp>;
};

export type StripeEventTable = {
  id: Uuid;
  stripe_event_id: string;
  stripe_account_id: string | null;
  event_type: string;
  api_version: string | null;
  payload: Json;
  processed_at: Timestamp | null;
  process_error: string | null;
  processing_at: Generated<Timestamp | null>;
  processing_by: Generated<string | null>;
  processing_attempts: Generated<number>;
  received_at: Generated<Timestamp>;
};

export type PaymentTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  stripe_account_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_application_fee_id: string | null;
  currency: string;
  exponent: number;
  customer_charge_minor: MoneyMinor;
  project_amount_minor: MoneyMinor;
  platform_tip_minor: MoneyMinor;
  oss_project_fee_minor: MoneyMinor;
  stripe_application_fee_minor: MoneyMinor;
  status: string;
  cadence: string;
  feature_mode: string;
  receipt_email: Generated<string | null>;
  public_show_name: Generated<boolean>;
  public_show_amount: Generated<boolean>;
  public_show_message: Generated<boolean>;
  public_display_name: Generated<string | null>;
  public_message: Generated<string | null>;
  settled_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PaymentAllocationTable = {
  id: Uuid;
  payment_id: Uuid;
  kind: string;
  amount_minor: MoneyMinor;
  currency: string;
  created_at: Generated<Timestamp>;
};

export type RefundTable = {
  id: Uuid;
  payment_id: Uuid;
  stripe_refund_id: string;
  idempotency_key: string | null;
  amount_minor: MoneyMinor;
  application_fee_refund_minor: MoneyMinor;
  stripe_application_fee_refund_id: string | null;
  currency: string;
  status: string;
  reason: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PaymentDisputeTable = {
  id: Uuid;
  payment_id: Uuid;
  stripe_dispute_id: string;
  status: string;
  amount_minor: MoneyMinor;
  currency: string;
  /** Stripe event ordering cursor; prevents stale dispute regressions. */
  last_event_created: Generated<string>;
  last_event_id: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type SubscriptionTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  tier_id: Uuid;
  stripe_subscription_id: string;
  stripe_account_id: string;
  status: string;
  current_period_end: Timestamp | null;
  grace_ends_at: Timestamp | null;
  cancel_at_period_end: boolean;
  /** Snapshot used to verify every invoice against the checkout decision. */
  project_amount_minor: NullableMoneyMinor;
  platform_tip_minor: NullableMoneyMinor;
  currency: Generated<string | null>;
  feature_mode: Generated<string | null>;
  cadence: Generated<string | null>;
  /** Stripe event ordering cursor; protects state from late webhook delivery. */
  last_event_created: Generated<string>;
  last_event_id: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type SubscriptionPeriodTable = {
  id: Uuid;
  subscription_id: Uuid;
  stripe_invoice_id: Generated<string | null>;
  period_start: Timestamp;
  period_end: Timestamp;
  payment_id: Uuid | null;
  created_at: Generated<Timestamp>;
};

export type ProviderBalanceTransactionTable = {
  id: Uuid;
  stripe_account_id: string;
  stripe_balance_transaction_id: string;
  currency: string;
  amount_minor: MoneyMinor;
  fee_minor: MoneyMinor;
  net_minor: MoneyMinor;
  type: string;
  source_id: string | null;
  available_on: Timestamp | null;
  raw: Json;
  created_at: Generated<Timestamp>;
};

export type ReconciliationRunTable = {
  id: Uuid;
  stripe_account_id: string;
  currency: string;
  period_start: string;
  period_end: string;
  status: string;
  provider_net_minor: MoneyMinor;
  ledger_net_minor: MoneyMinor;
  started_at: Timestamp;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

export type ReconciliationDifferenceTable = {
  id: Uuid;
  reconciliation_run_id: Uuid;
  classification: string;
  provider_object_id: string | null;
  expected_minor: MoneyMinor | null;
  actual_minor: MoneyMinor | null;
  currency: string;
  details: Json;
  created_at: Generated<Timestamp>;
};

export type CheckoutIntentTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  stripe_checkout_session_id: string | null;
  currency: string;
  project_amount_minor: MoneyMinor;
  platform_tip_minor: MoneyMinor;
  tier_id: Uuid | null;
  cadence: string;
  public_show_name: Generated<boolean>;
  public_show_amount: Generated<boolean>;
  public_show_message: Generated<boolean>;
  expires_at: Timestamp;
  created_at: Generated<Timestamp>;
};

export type GuestAccessTokenTable = {
  id: Uuid;
  kind: 'claim' | 'reply';
  token_hash: string;
  payment_id: Uuid | null;
  thread_id: Uuid | null;
  email_hash: string;
  attempt_count: number;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Membership / content
// ---------------------------------------------------------------------------

export type TierTable = {
  id: Uuid;
  project_id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  rank: number;
  is_active: boolean;
  one_off_duration: string | null;
  icon: Generated<string | null>;
  member_cap: Generated<number | null>;
  minimum_visibility: Generated<string>;
  badge: Generated<string | null>;
  discord_role_ids: Generated<string[]>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type TierPriceTable = {
  id: Uuid;
  tier_id: Uuid;
  currency: string;
  amount_minor: MoneyMinor;
  cadence: string;
  stripe_price_binding_id: Uuid | null;
  is_active: boolean;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type TierRewardTable = {
  id: Uuid;
  tier_id: Uuid;
  reward_type: string;
  label: string;
  description: string | null;
  metadata: Json;
  created_at: Generated<Timestamp>;
};

export type EntitlementTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  tier_id: Uuid | null;
  payment_id: Uuid | null;
  subscription_id: Uuid | null;
  kind: string;
  tier_rank: number;
  starts_at: Timestamp;
  ends_at: Timestamp | null;
  revoked_at: Timestamp | null;
  transition_key: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PostTable = {
  id: Uuid;
  project_id: Uuid;
  author_id: Uuid;
  title: string;
  slug: string;
  status: string;
  published_at: Timestamp | null;
  scheduled_at: Timestamp | null;
  notify_supporters: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PostRevisionTable = {
  id: Uuid;
  post_id: Uuid;
  revision_number: number;
  body_markdown: string;
  editor_json: Json | null;
  created_by: Uuid;
  created_at: Generated<Timestamp>;
};

export type PostVisibilityRuleTable = {
  id: Uuid;
  post_id: Uuid;
  rule_kind: string;
  minimum_tier_rank: number | null;
  selected_tier_ids: Json | null;
  created_at: Generated<Timestamp>;
};

export type PostAttachmentTable = {
  id: Uuid;
  post_revision_id: Uuid;
  object_asset_id: Uuid;
  sort_order: number;
  created_at: Generated<Timestamp>;
};

export type SupporterPublicProfileTable = {
  id: Uuid;
  user_id: Uuid;
  project_id: Uuid;
  display_name: string | null;
  show_amount: boolean;
  show_name: boolean;
  show_message: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type SupporterMessageThreadTable = {
  id: Uuid;
  project_id: Uuid;
  supporter_user_id: Uuid | null;
  payment_id: Uuid | null;
  status: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type MessageRateLimitTable = {
  id: Uuid;
  scope: 'thread' | 'user' | 'project';
  key_hash: string;
  window_started_at: Timestamp;
  message_count: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type MessageBlockTable = {
  id: Uuid;
  project_id: Uuid;
  thread_id: Uuid;
  blocker_key_hash: string;
  blocked_key_hash: string;
  created_at: Generated<Timestamp>;
};

export type SupporterMessageTable = {
  id: Uuid;
  thread_id: Uuid;
  author_user_id: Uuid | null;
  author_name: string | null;
  body: string;
  is_internal: Generated<boolean>;
  created_at: Generated<Timestamp>;
};

export type ProjectGoalTable = {
  id: Uuid;
  project_id: Uuid;
  goal_type: string;
  target_minor: MoneyMinor | null;
  target_count: number | null;
  currency: string | null;
  title: string;
  is_active: boolean;
  status: Generated<string>;
  deadline: Generated<Timestamp | null>;
  basis: Generated<string | null>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectTeamInviteTable = {
  id: Uuid;
  project_id: Uuid;
  email: string;
  role: string;
  capabilities: string[];
  invited_by: Uuid;
  status: string;
  expires_at: Timestamp;
  accepted_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export type DiscordConnectionTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  discord_user_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  scopes: string[];
  connected_at: Timestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type DiscordGuildTable = {
  id: Uuid;
  project_id: Uuid;
  discord_guild_id: string;
  guild_name: string | null;
  bot_installed: boolean;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type DiscordRoleMappingTable = {
  id: Uuid;
  discord_guild_id: Uuid;
  tier_id: Uuid;
  discord_role_id: string;
  created_at: Generated<Timestamp>;
};

export type DiscordRoleAssignmentTable = {
  id: Uuid;
  user_id: Uuid;
  discord_guild_id: Uuid;
  discord_role_id: string;
  entitlement_id: Uuid | null;
  status: string;
  last_synced_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

export type ApiKeyTable = {
  id: Uuid;
  project_id: Uuid;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: Timestamp | null;
  expires_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
};

export type WebhookEndpointTable = {
  id: Uuid;
  project_id: Uuid;
  url: string;
  secret_hash: string;
  events: string[];
  is_active: boolean;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type WebhookDeliveryTable = {
  id: Uuid;
  webhook_endpoint_id: Uuid;
  event_id: string;
  event_type: string;
  payload: Json;
  status: string;
  attempt_count: number;
  next_attempt_at: Timestamp | null;
  last_response_status: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type CustomDomainTable = {
  id: Uuid;
  project_id: Uuid;
  hostname: string;
  status: string;
  ssl_status: string | null;
  provider_id: Generated<string | null>;
  validation_method: Generated<string>;
  validation_name: Generated<string | null>;
  validation_value: Generated<string | null>;
  cname_target: Generated<string | null>;
  grace_until: Generated<Timestamp | null>;
  last_error: Generated<string | null>;
  retry_at: Generated<Timestamp | null>;
  canonical_enabled: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type EmailDeliveryTable = {
  id: Uuid;
  to_address: string;
  template: string;
  status: string;
  provider_id: string | null;
  metadata: Json;
  dedupe_key: Generated<string | null>;
  sent_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type EmailDeliveryEventTable = {
  id: Uuid;
  provider_event_id: string;
  provider_email_id: string | null;
  email_delivery_id: Uuid | null;
  event_type: string;
  status: string;
  occurred_at: Timestamp;
  created_at: Generated<Timestamp>;
};

export type EmailSuppressionTable = {
  email_address: string;
  reason: string;
  provider_event_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ObjectAssetTable = {
  id: Uuid;
  project_id: Uuid | null;
  purpose: string;
  visibility: string;
  storage_key: string;
  content_type: string;
  byte_size: bigint;
  reserved_bytes: Generated<bigint>;
  checksum: string | null;
  expires_at: Generated<Timestamp | null>;
  soft_deleted_at: Timestamp | null;
  legal_hold: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ObjectAssetVariantTable = {
  id: Uuid;
  object_asset_id: Uuid;
  project_id: Uuid;
  variant_name: 'sm' | 'md' | 'lg';
  visibility: 'public' | 'private';
  storage_key: string;
  content_type: string;
  byte_size: bigint;
  width: number;
  height: number;
  checksum: string;
  created_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Platform operations
// ---------------------------------------------------------------------------

export type AuditEventTable = {
  id: Uuid;
  actor_id: Uuid | null;
  actor_type: string;
  session_id: Uuid | null;
  action: string;
  resource_type: string;
  resource_id: Uuid | null;
  project_id: Uuid | null;
  reason: string | null;
  ip_hash: string | null;
  before_hash: string | null;
  after_hash: string | null;
  correlation_id: string;
  metadata_redacted: Json;
  occurred_at: Generated<Timestamp>;
};

export type AdminCaseTable = {
  id: Uuid;
  kind: string;
  status: string;
  subject_type: string;
  subject_id: Uuid;
  assigned_to: Uuid | null;
  notes: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  resolved_at: Timestamp | null;
};

export type AbuseReportTable = {
  id: Uuid;
  reporter_user_id: Uuid | null;
  reporter_key_hash: Generated<string | null>;
  project_id: Uuid | null;
  resource_type: string;
  resource_id: Uuid | null;
  reason: string;
  status: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type JobTable = {
  id: Uuid;
  queue: string;
  kind: string;
  payload: Json;
  /** Stable target key used to coalesce concurrent role-sync work. */
  dedupe_key: Generated<string | null>;
  status: string;
  attempt_count: number;
  max_attempts: number;
  run_at: Timestamp;
  locked_at: Timestamp | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type OutboxEventTable = {
  id: Uuid;
  aggregate_type: string;
  aggregate_id: Uuid;
  event_type: string;
  payload: Json;
  published_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

export type LedgerAccountBindingTable = {
  id: Uuid;
  account_code: number;
  scope_kind: string;
  scope_id: string;
  currency: string;
  tigerbeetle_account_id: string;
  metadata: Json;
  created_at: Generated<Timestamp>;
};

export type LedgerPostingIntentTable = {
  id: Uuid;
  stripe_event_id: string | null;
  stripe_account_id: string | null;
  payment_id: Uuid | null;
  posting_kind: string;
  posting_version: number;
  semantic_key: string;
  payload: Json;
  status: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type LedgerPostingResultTable = {
  id: Uuid;
  intent_id: Uuid;
  tigerbeetle_transfer_ids: string[];
  status: string;
  error: string | null;
  posted_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

export type MetricEventHourlyTable = {
  id: Uuid;
  project_id: Uuid | null;
  metric_name: string;
  hour_start: Timestamp;
  value: bigint;
  dimensions: Json;
  created_at: Generated<Timestamp>;
};

/** Short-lived hashes used only to make public event retries idempotent. */
export type MetricEventDedupeTable = {
  id: Uuid;
  project_id: Uuid;
  event_key_hash: string;
  created_at: Generated<Timestamp>;
};

export type ProjectMetricDailyTable = {
  id: Uuid;
  project_id: Uuid;
  day: string;
  currency: string | null;
  metric_name: string;
  value_minor: MoneyMinor | null;
  value_count: bigint | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type PlatformMetricDailyTable = {
  id: Uuid;
  day: string;
  metric_name: string;
  value_minor: MoneyMinor | null;
  value_count: bigint | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Database interface
// ---------------------------------------------------------------------------

export interface Database {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  passkey: PasskeyTable;
  user_security_event: UserSecurityEventTable;
  platform_member: PlatformMemberTable;
  otp_send_rate_limit: OtpSendRateLimitTable;
  api_rate_limit: ApiRateLimitTable;

  organisation: OrganisationTable;
  organisation_member: OrganisationMemberTable;
  project: ProjectTable;
  project_member: ProjectMemberTable;
  project_repository: ProjectRepositoryTable;
  project_claim: ProjectClaimTable;
  project_contact: ProjectContactTable;
  project_feature_mode: ProjectFeatureModeTable;
  project_review: ProjectReviewTable;
  project_status_history: ProjectStatusHistoryTable;

  stripe_connected_account: StripeConnectedAccountTable;
  stripe_capability_snapshot: StripeCapabilitySnapshotTable;
  stripe_customer_binding: StripeCustomerBindingTable;
  stripe_product_binding: StripeProductBindingTable;
  stripe_price_binding: StripePriceBindingTable;
  stripe_event: StripeEventTable;
  payment: PaymentTable;
  payment_allocation: PaymentAllocationTable;
  refund: RefundTable;
  payment_dispute: PaymentDisputeTable;
  subscription: SubscriptionTable;
  subscription_period: SubscriptionPeriodTable;
  provider_balance_transaction: ProviderBalanceTransactionTable;
  reconciliation_run: ReconciliationRunTable;
  reconciliation_difference: ReconciliationDifferenceTable;
  checkout_intent: CheckoutIntentTable;
  guest_access_token: GuestAccessTokenTable;

  tier: TierTable;
  tier_price: TierPriceTable;
  tier_reward: TierRewardTable;
  entitlement: EntitlementTable;
  post: PostTable;
  post_revision: PostRevisionTable;
  post_visibility_rule: PostVisibilityRuleTable;
  post_attachment: PostAttachmentTable;
  supporter_public_profile: SupporterPublicProfileTable;
  supporter_message_thread: SupporterMessageThreadTable;
  message_rate_limit: MessageRateLimitTable;
  message_block: MessageBlockTable;
  supporter_message: SupporterMessageTable;
  project_goal: ProjectGoalTable;
  project_team_invite: ProjectTeamInviteTable;

  discord_connection: DiscordConnectionTable;
  discord_guild: DiscordGuildTable;
  discord_role_mapping: DiscordRoleMappingTable;
  discord_role_assignment: DiscordRoleAssignmentTable;
  api_key: ApiKeyTable;
  webhook_endpoint: WebhookEndpointTable;
  webhook_delivery: WebhookDeliveryTable;
  custom_domain: CustomDomainTable;
  email_delivery: EmailDeliveryTable;
  email_delivery_event: EmailDeliveryEventTable;
  email_suppression: EmailSuppressionTable;
  object_asset: ObjectAssetTable;
  object_asset_variant: ObjectAssetVariantTable;

  audit_event: AuditEventTable;
  admin_case: AdminCaseTable;
  abuse_report: AbuseReportTable;
  job: JobTable;
  outbox_event: OutboxEventTable;
  ledger_account_binding: LedgerAccountBindingTable;
  ledger_posting_intent: LedgerPostingIntentTable;
  ledger_posting_result: LedgerPostingResultTable;
  metric_event_hourly: MetricEventHourlyTable;
  metric_event_dedupe: MetricEventDedupeTable;
  project_metric_daily: ProjectMetricDailyTable;
  platform_metric_daily: PlatformMetricDailyTable;
}

// Row helpers
export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type PlatformMember = Selectable<PlatformMemberTable>;

export type OtpSendRateLimit = Selectable<OtpSendRateLimitTable>;
export type NewOtpSendRateLimit = Insertable<OtpSendRateLimitTable>;
export type OtpSendRateLimitUpdate = Updateable<OtpSendRateLimitTable>;

export type ApiRateLimit = Selectable<ApiRateLimitTable>;
export type NewApiRateLimit = Insertable<ApiRateLimitTable>;

export type Project = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;
export type ProjectMember = Selectable<ProjectMemberTable>;
export type ProjectRepository = Selectable<ProjectRepositoryTable>;
export type ProjectClaim = Selectable<ProjectClaimTable>;

export type Payment = Selectable<PaymentTable>;
export type NewPayment = Insertable<PaymentTable>;

export type Entitlement = Selectable<EntitlementTable>;
export type NewEntitlement = Insertable<EntitlementTable>;

export type Subscription = Selectable<SubscriptionTable>;
export type NewSubscription = Insertable<SubscriptionTable>;
export type SubscriptionUpdate = Updateable<SubscriptionTable>;

export type SubscriptionPeriod = Selectable<SubscriptionPeriodTable>;
export type NewSubscriptionPeriod = Insertable<SubscriptionPeriodTable>;

export type ProviderBalanceTransaction = Selectable<ProviderBalanceTransactionTable>;
export type NewProviderBalanceTransaction = Insertable<ProviderBalanceTransactionTable>;
export type ReconciliationRun = Selectable<ReconciliationRunTable>;
export type NewReconciliationRun = Insertable<ReconciliationRunTable>;
export type ReconciliationDifference = Selectable<ReconciliationDifferenceTable>;
export type NewReconciliationDifference = Insertable<ReconciliationDifferenceTable>;

export type EmailDeliveryEvent = Selectable<EmailDeliveryEventTable>;
export type NewEmailDeliveryEvent = Insertable<EmailDeliveryEventTable>;
export type EmailSuppression = Selectable<EmailSuppressionTable>;
export type NewEmailSuppression = Insertable<EmailSuppressionTable>;

export type MetricEventDedupe = Selectable<MetricEventDedupeTable>;
export type NewMetricEventDedupe = Insertable<MetricEventDedupeTable>;

export type Post = Selectable<PostTable>;
export type NewPost = Insertable<PostTable>;

export type ProjectGoal = Selectable<ProjectGoalTable>;
export type NewProjectGoal = Insertable<ProjectGoalTable>;
export type ProjectTeamInvite = Selectable<ProjectTeamInviteTable>;
export type NewProjectTeamInvite = Insertable<ProjectTeamInviteTable>;
export type ProjectTeamInviteUpdate = Updateable<ProjectTeamInviteTable>;

export type Job = Selectable<JobTable>;
export type NewJob = Insertable<JobTable>;

export type StripeEvent = Selectable<StripeEventTable>;
export type NewStripeEvent = Insertable<StripeEventTable>;

export type AuditEvent = Selectable<AuditEventTable>;
export type NewAuditEvent = Insertable<AuditEventTable>;

export type Tier = Selectable<TierTable>;
export type NewTier = Insertable<TierTable>;

export type CheckoutIntent = Selectable<CheckoutIntentTable>;
export type GuestAccessToken = Selectable<GuestAccessTokenTable>;
export type NewGuestAccessToken = Insertable<GuestAccessTokenTable>;
export type NewCheckoutIntent = Insertable<CheckoutIntentTable>;

export type MessageRateLimit = Selectable<MessageRateLimitTable>;
export type NewMessageRateLimit = Insertable<MessageRateLimitTable>;
export type MessageBlock = Selectable<MessageBlockTable>;
export type NewMessageBlock = Insertable<MessageBlockTable>;
export type SupporterMessageThread = Selectable<SupporterMessageThreadTable>;
export type NewSupporterMessageThread = Insertable<SupporterMessageThreadTable>;

export type ObjectAsset = Selectable<ObjectAssetTable>;
export type NewObjectAsset = Insertable<ObjectAssetTable>;
export type ObjectAssetVariant = Selectable<ObjectAssetVariantTable>;
export type NewObjectAssetVariant = Insertable<ObjectAssetVariantTable>;

export type LedgerPostingIntent = Selectable<LedgerPostingIntentTable>;
export type NewLedgerPostingIntent = Insertable<LedgerPostingIntentTable>;
