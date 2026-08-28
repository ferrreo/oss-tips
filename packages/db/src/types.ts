import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/** UUID primary keys stored as strings. */
export type Uuid = string;

/** Money amounts in minor units — bigint in app, numeric string in DB. */
export type MoneyMinor = ColumnType<string, string | bigint | number, string | bigint | number>;

export type Timestamp = Date;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

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
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Timestamp | null;
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
  name: string;
  credential_id: string;
  public_key: string;
  counter: bigint;
  transports: string | null;
  created_at: Generated<Timestamp>;
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
  description: string | null;
  default_currency: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectMemberTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid;
  role: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type ProjectRepositoryTable = {
  id: Uuid;
  project_id: Uuid;
  provider: string;
  external_id: string;
  url: string;
  created_at: Generated<Timestamp>;
};

export type ProjectClaimTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  email: string;
  status: string;
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
  received_at: Generated<Timestamp>;
};

export type PaymentTable = {
  id: Uuid;
  project_id: Uuid;
  user_id: Uuid | null;
  stripe_account_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
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
  amount_minor: MoneyMinor;
  application_fee_refund_minor: MoneyMinor;
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
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type SubscriptionPeriodTable = {
  id: Uuid;
  subscription_id: Uuid;
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
  expires_at: Timestamp;
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

export type SupporterMessageTable = {
  id: Uuid;
  thread_id: Uuid;
  author_user_id: Uuid | null;
  author_name: string | null;
  body: string;
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
  sent_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};

export type ObjectAssetTable = {
  id: Uuid;
  project_id: Uuid | null;
  purpose: string;
  visibility: string;
  storage_key: string;
  content_type: string;
  byte_size: bigint;
  checksum: string | null;
  soft_deleted_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

// ---------------------------------------------------------------------------
// Platform operations
// ---------------------------------------------------------------------------

export type AuditEventTable = {
  id: Uuid;
  actor_user_id: Uuid | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: Uuid | null;
  project_id: Uuid | null;
  metadata: Json;
  ip_address: string | null;
  created_at: Generated<Timestamp>;
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
  supporter_message: SupporterMessageTable;
  project_goal: ProjectGoalTable;

  discord_connection: DiscordConnectionTable;
  discord_guild: DiscordGuildTable;
  discord_role_mapping: DiscordRoleMappingTable;
  discord_role_assignment: DiscordRoleAssignmentTable;
  api_key: ApiKeyTable;
  webhook_endpoint: WebhookEndpointTable;
  webhook_delivery: WebhookDeliveryTable;
  custom_domain: CustomDomainTable;
  email_delivery: EmailDeliveryTable;
  object_asset: ObjectAssetTable;

  audit_event: AuditEventTable;
  admin_case: AdminCaseTable;
  abuse_report: AbuseReportTable;
  job: JobTable;
  outbox_event: OutboxEventTable;
  ledger_account_binding: LedgerAccountBindingTable;
  ledger_posting_intent: LedgerPostingIntentTable;
  ledger_posting_result: LedgerPostingResultTable;
  metric_event_hourly: MetricEventHourlyTable;
  project_metric_daily: ProjectMetricDailyTable;
  platform_metric_daily: PlatformMetricDailyTable;
}

// Row helpers
export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type Project = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

export type Payment = Selectable<PaymentTable>;
export type NewPayment = Insertable<PaymentTable>;

export type Entitlement = Selectable<EntitlementTable>;
export type NewEntitlement = Insertable<EntitlementTable>;

export type Post = Selectable<PostTable>;
export type NewPost = Insertable<PostTable>;

export type ProjectGoal = Selectable<ProjectGoalTable>;
export type NewProjectGoal = Insertable<ProjectGoalTable>;

export type Job = Selectable<JobTable>;
export type NewJob = Insertable<JobTable>;

export type StripeEvent = Selectable<StripeEventTable>;
export type NewStripeEvent = Insertable<StripeEventTable>;

export type AuditEvent = Selectable<AuditEventTable>;
export type NewAuditEvent = Insertable<AuditEventTable>;

export type Tier = Selectable<TierTable>;
export type NewTier = Insertable<TierTable>;

export type CheckoutIntent = Selectable<CheckoutIntentTable>;
export type NewCheckoutIntent = Insertable<CheckoutIntentTable>;

export type LedgerPostingIntent = Selectable<LedgerPostingIntentTable>;
export type NewLedgerPostingIntent = Insertable<LedgerPostingIntentTable>;
