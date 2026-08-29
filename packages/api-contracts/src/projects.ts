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
  updated_at: TimestampSchema,
});

export const TierSchema = z.object({
  id: IdSchema,
  name: z.string(),
  rank: z.number().int(),
  monthly_amount: MoneySchema.nullable(),
  annual_amount: MoneySchema.nullable(),
  benefits: z.array(z.string()),
});

export const GoalSchema = z.object({
  id: IdSchema,
  title: z.string(),
  type: z.enum(['one_time_money', 'recurring_money', 'supporter_count']),
  target: MoneySchema.or(z.number().int()).nullable(),
  progress_percent: z.number().min(0).max(100),
  updated_at: TimestampSchema,
});

export const PostSummarySchema = z.object({
  id: IdSchema,
  slug: z.string(),
  title: z.string(),
  published_at: TimestampSchema.nullable(),
  gated: z.boolean(),
});

export const PublicSupporterSchema = z.object({
  display_name: z.string().nullable(),
  amount: MoneySchema.optional(),
  message: z.string().nullable(),
  created_at: TimestampSchema,
});

export const ProjectListResponseSchema = z.object({
  data: z.array(ProjectSummarySchema),
  next_cursor: z.string().nullable(),
});
