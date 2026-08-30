import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  Database,
  PaymentDisputeTable,
  PaymentTable,
  RefundTable,
  StripeConnectedAccountTable,
} from './types.js';

describe('Database types', () => {
  it('includes all documented table groups', () => {
    const keys: (keyof Database)[] = [
      'user',
      'session',
      'account',
      'verification',
      'passkey',
      'user_security_event',
      'otp_send_rate_limit',
      'api_rate_limit',
      'organisation',
      'organisation_member',
      'project',
      'project_member',
      'project_repository',
      'project_claim',
      'project_contact',
      'project_feature_mode',
      'project_review',
      'project_status_history',
      'stripe_connected_account',
      'stripe_capability_snapshot',
      'stripe_customer_binding',
      'stripe_product_binding',
      'stripe_price_binding',
      'stripe_event',
      'payment',
      'payment_allocation',
      'refund',
      'payment_dispute',
      'subscription',
      'subscription_period',
      'provider_balance_transaction',
      'reconciliation_run',
      'reconciliation_difference',
      'checkout_intent',
      'guest_access_token',
      'tier',
      'tier_price',
      'tier_reward',
      'entitlement',
      'post',
      'post_revision',
      'post_visibility_rule',
      'post_attachment',
      'supporter_public_profile',
      'supporter_message_thread',
      'message_rate_limit',
      'message_block',
      'supporter_message',
      'project_goal',
      'project_team_invite',
      'discord_connection',
      'discord_guild',
      'discord_role_mapping',
      'discord_role_assignment',
      'api_key',
      'webhook_endpoint',
      'webhook_delivery',
      'custom_domain',
      'email_delivery',
      'object_asset',
      'object_asset_variant',
      'audit_event',
      'admin_case',
      'abuse_report',
      'job',
      'outbox_event',
      'ledger_account_binding',
      'ledger_posting_intent',
      'ledger_posting_result',
      'metric_event_hourly',
      'metric_event_dedupe',
      'project_metric_daily',
      'platform_metric_daily',
    ];

    const tableSet = new Set<string>(keys);
    expect(tableSet.size).toBe(73);
  });

  it('keeps provider correction identities in database contracts', () => {
    expectTypeOf<PaymentTable>().toHaveProperty('stripe_application_fee_id');
    expectTypeOf<RefundTable>().toHaveProperty('idempotency_key');
    expectTypeOf<RefundTable>().toHaveProperty('stripe_application_fee_refund_id');
    expectTypeOf<PaymentDisputeTable>().toHaveProperty('last_event_created');
    expectTypeOf<PaymentDisputeTable>().toHaveProperty('last_event_id');
    expectTypeOf<StripeConnectedAccountTable>().toHaveProperty('last_event_created');
    expectTypeOf<StripeConnectedAccountTable>().toHaveProperty('last_event_id');
  });
});
