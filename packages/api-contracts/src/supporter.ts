import { z } from 'zod';
import { IdSchema, TimestampSchema } from './money.js';
import { MoneySchema } from './money.js';

export const MeSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  display_name: z.string().nullable(),
  created_at: TimestampSchema,
});

export const SupportRecordSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  project_slug: z.string(),
  amount: MoneySchema,
  status: z.enum(['processing', 'succeeded', 'refunded', 'disputed']),
  created_at: TimestampSchema,
});

export const MembershipSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  tier_id: IdSchema,
  status: z.enum(['active', 'grace', 'cancelled', 'expired', 'incomplete']),
  current_period_end: TimestampSchema.nullable(),
  cancel_at_period_end: z.boolean(),
});

export const EntitlementSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  kind: z.enum(['membership', 'one_off']),
  tier_rank: z.number().int().nullable(),
  starts_at: TimestampSchema,
  ends_at: TimestampSchema.nullable(),
});

export const InboxThreadSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  subject: z.string(),
  updated_at: TimestampSchema,
  unread: z.boolean(),
});

export const ThreadMessageSchema = z.object({
  id: IdSchema,
  body: z.string(),
  from_supporter: z.boolean(),
  created_at: TimestampSchema,
});

export const PublicSupportPatchSchema = z.object({
  show_name: z.boolean().optional(),
  show_amount: z.boolean().optional(),
  show_message: z.boolean().optional(),
  message: z.string().max(2000).optional(),
});

export const DiscordLinkSchema = z.object({
  redirect_url: z.string().url(),
});
