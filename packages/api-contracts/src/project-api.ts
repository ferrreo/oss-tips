import { z } from 'zod';
import { IdSchema, MoneySchema, SupportedCurrencySchema, TimestampSchema } from './money.js';
import { PostSummarySchema, TierSchema, GoalSchema } from './projects.js';
import { OutgoingEventTypeSchema } from './webhooks.js';

export const ProjectRepositorySchema = z.object({
  id: IdSchema,
  provider: z.string().trim().min(1).max(40),
  external_id: z.string().trim().min(1).max(300),
  url: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'Repository URL must use HTTP(S)'),
  verification_status: z.enum(['pending', 'verified', 'failed']).default('pending'),
  verified_at: TimestampSchema.nullable().default(null),
});

export const ProjectOwnershipSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected', 'manual_review']),
  method: z.enum(['repository_oauth', 'repository_file', 'website_dns', 'manual_email']),
  proof_reference: z.string().nullable(),
  failure_reason: z.string().nullable().default(null),
  next_action: z.enum(['awaiting_proof', 'manual_review', 'none']),
  updated_at: TimestampSchema.nullable(),
});

export const ProjectPublishEligibilitySchema = z.object({
  eligible: z.boolean(),
  missing: z.array(
    z.enum([
      'website',
      'support_email',
      'verified_support_email',
      'repository',
      'open_source_declaration',
      'ownership_verification',
    ]),
  ),
});

export const ProjectSettingsSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  default_currency: z.string().regex(/^[a-z]{3}$/),
  feature_mode: z.enum(['standard', 'contributes_5_percent']),
  stripe_account_id: z.string().nullable(),
  website_url: z.string().url().nullable().default(null),
  support_email: z.string().email().nullable().default(null),
  support_email_verified: z.boolean().default(false),
  repository: ProjectRepositorySchema.nullable().default(null),
  open_source_declared: z.boolean().default(false),
  open_source_license: z.string().nullable().default(null),
  min_support: MoneySchema.nullable().default(null),
  max_support: MoneySchema.nullable().default(null),
  public_display: z
    .object({
      show_supporters: z.boolean(),
      show_goal: z.boolean(),
      show_stats: z.boolean(),
      show_gated_post_metadata: z.boolean().default(false),
    })
    .default({
      show_supporters: true,
      show_goal: true,
      show_stats: false,
      show_gated_post_metadata: false,
    }),
  assets: z
    .object({
      logo_asset_id: IdSchema.nullable(),
      banner_asset_id: IdSchema.nullable(),
    })
    .default({ logo_asset_id: null, banner_asset_id: null }),
  discovery: z
    .object({
      ecosystems: z.array(z.string()),
      languages: z.array(z.string()),
      tags: z.array(z.string()),
    })
    .default({ ecosystems: [], languages: [], tags: [] }),
  ownership: ProjectOwnershipSchema,
  publish_eligibility: ProjectPublishEligibilitySchema,
});

export const ProjectSettingsPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(5000).nullable().optional(),
    default_currency: SupportedCurrencySchema.optional(),
    feature_mode: z.enum(['standard', 'contributes_5_percent']).optional(),
    website_url: z.string().url().nullable().optional(),
    support_email: z.string().email().nullable().optional(),
    repository: ProjectRepositorySchema.omit({
      id: true,
      verification_status: true,
      verified_at: true,
    })
      .nullable()
      .optional(),
    open_source_declared: z.boolean().optional(),
    open_source_license: z.string().trim().max(120).nullable().optional(),
    min_support: MoneySchema.nullable().optional(),
    max_support: MoneySchema.nullable().optional(),
    public_display: z
      .object({
        show_supporters: z.boolean().optional(),
        show_goal: z.boolean().optional(),
        show_stats: z.boolean().optional(),
        show_gated_post_metadata: z.boolean().optional(),
      })
      .strict()
      .optional(),
    logo_asset_id: IdSchema.nullable().optional(),
    banner_asset_id: IdSchema.nullable().optional(),
    discovery: z
      .object({
        ecosystems: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
        languages: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
        tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ProjectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    description: z.string().trim().min(1).max(5000),
    website_url: z
      .string()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), 'Website URL must use HTTP(S)'),
    support_email: z.string().trim().email().max(320),
    repository_url: z
      .string()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), 'Repository URL must use HTTP(S)'),
    open_source_declared: z.literal(true),
    open_source_license: z.string().trim().max(120).nullable().optional(),
    default_currency: SupportedCurrencySchema.default('gbp'),
    organisation_id: IdSchema.optional(),
    organisation_name: z.string().trim().min(1).max(160).optional(),
    discovery: z
      .object({
        ecosystems: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
        languages: z.array(z.string().trim().min(1).max(60)).default([]),
        tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
      })
      .strict()
      .default({ ecosystems: [], languages: [], tags: [] }),
  })
  .strict();

export const ProjectSupportEmailVerificationRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('send'),
      email: z.string().trim().email().max(320).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('confirm'),
      code: z.string().regex(/^\d{6}$/),
    })
    .strict(),
]);

export const ProjectSupportEmailVerificationSchema = z.object({
  status: z.enum(['pending', 'verified']),
  email: z.string().email(),
  expires_at: TimestampSchema.nullable(),
});

export const RefundRequestSchema = z
  .object({
    amount_minor: z.number().int().safe().positive().optional(),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const WebhookEndpointSchema = z.object({
  id: IdSchema,
  url: z
    .string()
    .url()
    .regex(/^https:\/\//i),
  api_version: z.string(),
  events: z.array(OutgoingEventTypeSchema),
  enabled: z.boolean(),
  created_at: TimestampSchema,
});

export const WebhookEndpointCreateSchema = z
  .object({
    url: z
      .string()
      .url()
      .regex(/^https:\/\//i),
    api_version: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .default('2026-08-01'),
    events: z.array(OutgoingEventTypeSchema).min(1).max(50),
  })
  .strict();

export const WebhookEndpointPatchSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const WebhookReplayRequestSchema = z
  .object({
    delivery_id: IdSchema,
  })
  .strict();

export const WebhookReplayResponseSchema = z.object({
  id: IdSchema,
  status: z.literal('queued'),
  event_id: z.string().min(1),
});

export const WebhookEndpointCreatedSchema = WebhookEndpointSchema.extend({
  secret: z.string().min(16),
});

export const ApiKeySchema = z.object({
  id: IdSchema,
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  created_at: TimestampSchema,
  last_used_at: TimestampSchema.nullable(),
  expires_at: TimestampSchema.nullable(),
});

export const ApiKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    scopes: z.array(z.string().min(1)).min(1).max(20),
    expires_at: TimestampSchema.nullable().optional(),
  })
  .strict();

export const ApiKeyCreatedSchema = ApiKeySchema.extend({
  secret: z.string().min(16),
});

export const DomainSchema = z.object({
  id: IdSchema,
  hostname: z.string(),
  status: z.enum([
    'requested',
    'awaiting_dns',
    'validating',
    'active',
    'failed',
    'grace_disabled',
    'removed',
  ]),
  created_at: TimestampSchema,
});

export const DomainCreateSchema = z
  .object({
    hostname: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
  })
  .strict();

const AnalyticsMoneyRowSchema = z.object({
  currency: z.string().regex(/^[a-z]{3}$/),
  gross_settled_support: z.string().regex(/^\d+$/),
  refunds_disputes: z.string().regex(/^\d+$/),
  oss_tips_fee: z.string().regex(/^\d+$/),
  oss_tips_tip: z.string().regex(/^\d+$/),
  stripe_fee: z.string().regex(/^\d+$/).nullable(),
  estimated_net: z.string().regex(/^\d+$/),
  one_off: z.string().regex(/^\d+$/),
  recurring: z.string().regex(/^\d+$/),
});

const AnalyticsMembershipLifecycleSchema = z.object({
  new: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  grace: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
});

const AnalyticsRetentionSchema = z.array(
  z.object({
    cohort: z.string().regex(/^\d{4}-\d{2}$/),
    started: z.number().int().nonnegative(),
    retained: z.number().int().nonnegative(),
    retention_percent: z.number().min(0).max(100),
    churn_percent: z.number().min(0).max(100),
  }),
);

const AnalyticsTierMixSchema = z.array(
  z.object({
    tier_id: IdSchema,
    tier_name: z.string(),
    members: z.number().int().nonnegative(),
    share_percent: z.number().min(0).max(100),
  }),
);

const AnalyticsCountrySchema = z.array(
  z.object({
    country: z.string().regex(/^[A-Z]{2}$/),
    supporters: z.number().int().nonnegative(),
    share_percent: z.number().min(0).max(100),
  }),
);

const AnalyticsReferrerSchema = z.array(
  z.object({
    referrer: z.enum([
      'direct',
      'github',
      'gitlab',
      'bitbucket',
      'discord',
      'reddit',
      'hacker_news',
      'twitter',
      'linkedin',
      'youtube',
      'search',
      'other',
    ]),
    page_views: z.number().int().nonnegative(),
    composer_opens: z.number().int().nonnegative(),
    confirmed_conversions: z.number().int().nonnegative(),
    conversion_percent: z.number().min(0).max(100),
    share_percent: z.number().min(0).max(100),
  }),
);

const AnalyticsConversionSchema = z.object({
  page_views: z.number().int().nonnegative(),
  composer_opens: z.number().int().nonnegative(),
  confirmed_conversions: z.number().int().nonnegative(),
  conversion_percent: z.number().min(0).max(100),
});

const AnalyticsGoalProgressSchema = z.array(
  z.object({
    id: IdSchema,
    title: z.string(),
    goal_type: z.string(),
    currency: z
      .string()
      .regex(/^[a-z]{3}$/)
      .nullable(),
    target: z.string().regex(/^\d+$/).nullable(),
    target_count: z.number().int().nonnegative().nullable(),
    current: z.string().regex(/^\d+$/).nullable(),
    current_count: z.number().int().nonnegative().nullable(),
    percent: z.number().min(0),
  }),
);

const AnalyticsSeriesSchema = z.array(
  z.object({
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(100),
    points: z.array(
      z.object({
        label: z.string().min(1).max(32),
        value: z.number().finite(),
      }),
    ),
    stroke: z.enum(['solid', 'dashed']),
    marker: z.enum(['circle', 'square', 'diamond']),
  }),
);

const AnalyticsBreakdownSchema = z.array(
  z.object({
    source: z.string().min(1).max(100),
    gross: z.string().regex(/^-?\d+$/),
    fees: z.string().regex(/^-?\d+$/),
    net: z.string().regex(/^-?\d+$/),
    share_percent: z.number().min(0).max(100),
  }),
);

export const AnalyticsSummarySchema = z.object({
  period_start: TimestampSchema,
  period_end: TimestampSchema,
  currency: z.string().regex(/^[a-z]{3}$/),
  gross_settled_support: MoneySchema,
  refunds_disputes: MoneySchema,
  oss_tips_fee: MoneySchema,
  oss_tips_tip: MoneySchema,
  stripe_fee: MoneySchema.nullable(),
  estimated_net: MoneySchema,
  one_off: MoneySchema,
  recurring: MoneySchema,
  mrr: MoneySchema,
  arr: MoneySchema,
  active_members: z.number().int().nonnegative(),
  membership_lifecycle: AnalyticsMembershipLifecycleSchema,
  retention: AnalyticsRetentionSchema,
  tier_mix: AnalyticsTierMixSchema,
  country_distribution: AnalyticsCountrySchema,
  referrer_distribution: AnalyticsReferrerSchema,
  conversion: AnalyticsConversionSchema,
  goal_progress: AnalyticsGoalProgressSchema,
  support_series: AnalyticsSeriesSchema,
  growth_series: AnalyticsSeriesSchema,
  breakdown: AnalyticsBreakdownSchema,
  currencies: z.array(AnalyticsMoneyRowSchema),
  stripe_fee_available: z.boolean(),
  provider_limitations: z.array(z.string()),
  // Kept for callers of the original small analytics contract.
  one_off_total: MoneySchema,
});

export const PublicAnalyticsEventSchema = z
  .object({
    // Conversion events are emitted by the settlement worker after Stripe
    // confirms payment; browsers may only report coarse funnel steps. Country
    // comes from the trusted edge header; referrer is reduced to a category.
    event: z.enum(['page_view', 'support_composer_open']),
    referrer: z.string().trim().max(2048).nullable().optional(),
  })
  .strict();

export const PublicAnalyticsEventResponseSchema = z.object({
  accepted: z.boolean(),
  duplicate: z.boolean(),
});

export const ExportRequestSchema = z.object({
  kind: z.enum(['supporters', 'payments', 'memberships']),
  format: z.enum(['csv', 'json']).default('csv'),
});

export const ProjectPostSchema = PostSummarySchema.extend({
  body: z.string().nullable(),
  minimum_tier_rank: z.number().int().nullable(),
  scheduled_at: TimestampSchema.nullable().default(null),
  notify_supporters: z.boolean().default(false),
});
export type ProjectPost = z.infer<typeof ProjectPostSchema>;

export const ProjectPostCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
    body: z.string().max(100_000).default(''),
    minimum_tier_rank: z.number().int().nonnegative().nullable().optional(),
    scheduled_at: TimestampSchema.nullable().optional(),
    notify_supporters: z.boolean().optional(),
  })
  .strict();

export const ProjectPostPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(100_000).nullable().optional(),
    scheduled_at: TimestampSchema.nullable().optional(),
    notify_supporters: z.boolean().optional(),
  })
  .strict();

export const ProjectTierPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    icon: z.string().trim().max(80).nullable().optional(),
    rank: z.number().int().min(0).max(7).optional(),
    member_cap: z.number().int().positive().max(1_000_000).nullable().optional(),
    one_off_duration: z.enum(['days_30', 'days_90', 'year', 'permanent']).nullable().optional(),
    minimum_visibility: z
      .enum(['public', 'signed_in_supporter', 'minimum_tier', 'selected_tiers'])
      .optional(),
    discord_guild_id: z.string().trim().min(1).max(100).optional(),
    discord_roles: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    badge: z.string().trim().max(100).nullable().optional(),
    one_off_amount: MoneySchema.nullable().optional(),
    monthly_amount: MoneySchema.nullable().optional(),
    annual_amount: MoneySchema.nullable().optional(),
    monthly_amount_minor: z.number().int().safe().positive().optional(),
    annual_amount_minor: z.number().int().safe().positive().optional(),
    benefits: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  })
  .strict();

export const ProjectGoalSchema = GoalSchema;

export const ProjectGoalCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    goal_type: z.enum([
      'one_time_money',
      'calendar_month_money',
      'active_supporter_count',
      'mrr',
      'recurring_money',
      'supporter_count',
    ]),
    target_minor: z.number().int().safe().positive().optional(),
    target_count: z.number().int().safe().positive().optional(),
    currency: z
      .string()
      .regex(/^[a-z]{3}$/)
      .optional(),
    deadline: TimestampSchema.nullable().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    basis: z.string().trim().max(80).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const countGoal =
      value.goal_type === 'supporter_count' || value.goal_type === 'active_supporter_count';
    if (countGoal && value.target_count === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_count'],
        message: 'target_count is required',
      });
    }
    if (!countGoal && value.target_minor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_minor'],
        message: 'target_minor is required',
      });
    }
  });

export const ProjectGoalPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    goal_type: z
      .enum([
        'one_time_money',
        'calendar_month_money',
        'active_supporter_count',
        'mrr',
        'recurring_money',
        'supporter_count',
      ])
      .optional(),
    target_minor: z.number().int().safe().positive().nullable().optional(),
    target_count: z.number().int().safe().positive().nullable().optional(),
    currency: z
      .string()
      .regex(/^[a-z]{3}$/)
      .nullable()
      .optional(),
    deadline: TimestampSchema.nullable().optional(),
    status: z.enum(['draft', 'published']).optional(),
    basis: z.string().trim().max(80).nullable().optional(),
  })
  .strict();

export const ProjectGoalPublishSchema = z.object({ confirm: z.literal(true) }).strict();

export const ProjectTierCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    rank: z.number().int().min(0).max(7),
    description: z.string().trim().max(1000).nullable().optional(),
    icon: z.string().trim().max(80).nullable().optional(),
    member_cap: z.number().int().positive().max(1_000_000).nullable().optional(),
    one_off_duration: z.enum(['days_30', 'days_90', 'year', 'permanent']).nullable().optional(),
    minimum_visibility: z
      .enum(['public', 'signed_in_supporter', 'minimum_tier', 'selected_tiers'])
      .default('public'),
    discord_guild_id: z.string().trim().min(1).max(100).optional(),
    discord_roles: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    badge: z.string().trim().max(100).nullable().optional(),
    monthly_amount: MoneySchema.nullable(),
    annual_amount: MoneySchema.nullable(),
    one_off_amount: MoneySchema.nullable().default(null),
    benefits: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  })
  .strict();

export const ProjectTeamMemberSchema = z.object({
  id: IdSchema,
  user_id: IdSchema,
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'finance', 'editor', 'community', 'analyst']),
  capabilities: z.array(z.string()),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export const ProjectTeamInviteSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  role: z.enum(['admin', 'finance', 'editor', 'community', 'analyst']),
  capabilities: z.array(z.string()),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: TimestampSchema,
  created_at: TimestampSchema,
});

export const ProjectTeamSchema = z.object({
  members: z.array(ProjectTeamMemberSchema),
  invites: z.array(ProjectTeamInviteSchema),
});

export const ProjectTeamInviteCreateSchema = z
  .object({
    email: z.string().trim().email().max(320),
    role: z.enum(['admin', 'finance', 'editor', 'community', 'analyst']),
    capabilities: z.array(z.string().min(1)).max(30).optional(),
  })
  .strict();

export const ProjectTeamMemberPatchSchema = z
  .object({
    role: z.enum(['owner', 'admin', 'finance', 'editor', 'community', 'analyst']).optional(),
    capabilities: z.array(z.string().min(1)).max(30).optional(),
  })
  .strict();

export const ProjectTeamInviteAcceptSchema = z.object({
  status: z.literal('accepted'),
  project_id: IdSchema,
});

export const ProjectOwnershipRequestSchema = z
  .object({
    method: z.enum(['repository_oauth', 'repository_file', 'website_dns', 'manual_email']),
    proof_reference: z.string().trim().max(500).optional(),
  })
  .strict();

export const ProjectOwnershipTransferRequestSchema = z
  .object({
    member_id: IdSchema.optional(),
    email: z.string().trim().email().max(320).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.member_id) !== Boolean(value.email), {
    message: 'Provide exactly one target team member',
  });

export const ProjectOwnershipTransferSchema = z.object({
  status: z.literal('transferred'),
  project_id: IdSchema,
  previous_owner_id: IdSchema,
  new_owner_id: IdSchema,
});

export const ProjectClosureRequestSchema = z
  .object({
    confirm: z.literal(true),
  })
  .strict();

export const ProjectClosureSchema = z.object({
  status: z.enum(['closed', 'already_closed']),
  project_id: IdSchema,
  closed_at: TimestampSchema,
});

export const ProjectOwnershipReviewSchema = ProjectOwnershipSchema.extend({
  claim_id: IdSchema,
  project_id: IdSchema,
  project_slug: z.string(),
  project_name: z.string(),
  email: z.string().email(),
  repository_url: z.string().url().nullable(),
});

export const ProjectOwnershipReviewListSchema = z.object({
  data: z.array(ProjectOwnershipReviewSchema),
});

export const ProjectOwnershipReviewDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'hold']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const ProjectPublishSchema = z
  .object({
    confirm: z.literal(true),
  })
  .strict();
