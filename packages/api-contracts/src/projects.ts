import { z } from 'zod';
import { IdSchema, MoneySchema, TimestampSchema } from './money.js';

export const ProjectSummarySchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  canonical_url: z.string().url(),
  payment_status: z.enum(['active', 'restricted', 'pending']),
  tags: z.array(z.string()),
  website_url: z.string().url().nullable().default(null),
  repository_url: z.string().url().nullable().default(null),
  logo_asset_id: IdSchema.nullable().default(null),
  banner_asset_id: IdSchema.nullable().default(null),
  ecosystems: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  updated_at: TimestampSchema,
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const TierSchema = z.object({
  id: IdSchema,
  name: z.string(),
  rank: z.number().int(),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  member_cap: z.number().int().positive().nullable().default(null),
  one_off_duration: z.enum(['days_30', 'days_90', 'year', 'permanent']).nullable().default(null),
  minimum_visibility: z
    .enum(['public', 'signed_in_supporter', 'minimum_tier', 'selected_tiers'])
    .default('public'),
  discord_roles: z.array(z.string()).default([]),
  badge: z.string().nullable().default(null),
  one_off_amount: MoneySchema.nullable().default(null),
  monthly_amount: MoneySchema.nullable(),
  annual_amount: MoneySchema.nullable(),
  benefits: z.array(z.string()),
});
export type Tier = z.infer<typeof TierSchema>;

export const GoalSchema = z.object({
  id: IdSchema,
  title: z.string(),
  type: z.enum([
    'one_time_money',
    'calendar_month_money',
    'active_supporter_count',
    'mrr',
    // Legacy aliases remain readable for older integrations.
    'recurring_money',
    'supporter_count',
  ]),
  target: MoneySchema.or(z.number().int()).nullable(),
  progress_percent: z.number().min(0).max(100),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  deadline: TimestampSchema.nullable().default(null),
  basis: z.string().nullable().default(null),
  updated_at: TimestampSchema,
});
export type Goal = z.infer<typeof GoalSchema>;

export const PostSummarySchema = z.object({
  id: IdSchema,
  slug: z.string(),
  title: z.string(),
  published_at: TimestampSchema.nullable(),
  gated: z.boolean(),
});
export type PostSummary = z.infer<typeof PostSummarySchema>;

export const PublicSupporterSchema = z.object({
  display_name: z.string().nullable(),
  amount: MoneySchema.optional(),
  message: z.string().nullable(),
  duration: z.string().nullable().optional(),
  created_at: TimestampSchema,
});
export type PublicSupporter = z.infer<typeof PublicSupporterSchema>;

export const ProjectCursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);

export const ProjectListResponseSchema = z.object({
  data: z.array(ProjectSummarySchema),
  /** Opaque keyset cursor. Clients must pass it back unchanged. */
  next_cursor: ProjectCursorSchema.nullable(),
});
