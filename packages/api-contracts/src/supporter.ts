import { z } from 'zod';
import { IdSchema, TimestampSchema } from './money.js';
import { MoneySchema } from './money.js';

export const MeSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  display_name: z.string().nullable(),
  created_at: TimestampSchema,
});

export const AccountPreferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  locale: z.enum(['en-GB', 'de', 'fr', 'es', 'pt-BR']),
});

export const AccountPreferencesPatchSchema = AccountPreferencesSchema.partial()
  .strict()
  .refine((value) => value.theme !== undefined || value.locale !== undefined, {
    message: 'At least one preference is required',
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
  platform_tip: MoneySchema.nullable().optional(),
});

export const MembershipPatchSchema = z
  .object({
    cancel_at_period_end: z.boolean().optional(),
    platform_tip: MoneySchema.optional(),
  })
  .strict()
  .refine((value) => value.cancel_at_period_end !== undefined || value.platform_tip !== undefined, {
    message: 'At least one membership change is required',
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

export const ThreadMessageCreateSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const PublicSupportPatchSchema = z
  .object({
    show_name: z.boolean().optional(),
    show_amount: z.boolean().optional(),
    show_message: z.boolean().optional(),
    message: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.message && /(?:https?|ftp|javascript|data):|www\./i.test(value.message)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'Message must not contain links',
      });
    }
  });

export const DiscordLinkSchema = z.object({
  redirect_url: z.string().url(),
});

export const DiscordLinkRequestSchema = z
  .object({
    project_id: IdSchema.optional(),
    redirect_url: z.string().url().optional(),
  })
  .strict();
