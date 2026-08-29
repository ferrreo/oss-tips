import { z } from 'zod';
import { IdSchema, TimestampSchema } from './money.js';
import { MoneySchema } from './money.js';
import { PostSummarySchema, TierSchema, GoalSchema } from './projects.js';

export const ProjectSettingsSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  default_currency: z.string().length(3),
  feature_mode: z.enum(['standard', 'contributes_5_percent']),
  stripe_account_id: z.string().nullable(),
});

export const RefundRequestSchema = z.object({
  amount_minor: z.number().int().positive().optional(),
  reason: z.string().min(1).max(500),
});

export const WebhookEndpointSchema = z.object({
  id: IdSchema,
  url: z.string().url(),
  api_version: z.string(),
  enabled: z.boolean(),
  created_at: TimestampSchema,
});

export const ApiKeySchema = z.object({
  id: IdSchema,
  prefix: z.string(),
  scopes: z.array(z.string()),
  created_at: TimestampSchema,
  last_used_at: TimestampSchema.nullable(),
});

export const DomainSchema = z.object({
  id: IdSchema,
  hostname: z.string(),
  status: z.enum(['requested', 'awaiting_dns', 'validating', 'active', 'failed', 'grace_disabled', 'removed']),
  created_at: TimestampSchema,
});

export const AnalyticsSummarySchema = z.object({
  mrr: MoneySchema,
  active_members: z.number().int(),
  one_off_total: MoneySchema,
  period_start: TimestampSchema,
  period_end: TimestampSchema,
});

export const ExportRequestSchema = z.object({
  kind: z.enum(['supporters', 'payments', 'memberships']),
  format: z.enum(['csv', 'json']).default('csv'),
});

export const ProjectPostSchema = PostSummarySchema.extend({
  body: z.string().nullable(),
  minimum_tier_rank: z.number().int().nullable(),
});

export const ProjectTierPatchSchema = z.object({
  name: z.string().optional(),
  monthly_amount_minor: z.number().int().positive().optional(),
  annual_amount_minor: z.number().int().positive().optional(),
  benefits: z.array(z.string()).optional(),
});

export const ProjectGoalSchema = GoalSchema;

export const ProjectTierCreateSchema = TierSchema.omit({ id: true }).partial({ benefits: true });
