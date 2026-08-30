import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type {
  ResponseConfig,
  RouteConfig,
} from '@asteasolutions/zod-to-openapi/dist/openapi-registry.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { z } from 'zod';
import { CheckoutIntentRequestSchema, CheckoutIntentResponseSchema } from './checkout.js';
import { ProblemDetailsSchema } from './problem.js';
import {
  ProjectListResponseSchema,
  ProjectCursorSchema,
  ProjectSummarySchema,
  TierSchema,
  GoalSchema,
  PostSummarySchema,
  PublicSupporterSchema,
} from './projects.js';
import {
  MeSchema,
  AccountPreferencesSchema,
  AccountPreferencesPatchSchema,
  SupportRecordSchema,
  MembershipSchema,
  MembershipPatchSchema,
  EntitlementSchema,
  InboxThreadSchema,
  ThreadMessageSchema,
  ThreadMessageCreateSchema,
  PublicSupportPatchSchema,
  DiscordLinkSchema,
  DiscordLinkRequestSchema,
} from './supporter.js';
import {
  ProjectSettingsSchema,
  ProjectSettingsPatchSchema,
  ProjectCreateSchema,
  ProjectSupportEmailVerificationRequestSchema,
  ProjectSupportEmailVerificationSchema,
  RefundRequestSchema,
  WebhookEndpointSchema,
  WebhookEndpointCreateSchema,
  WebhookEndpointPatchSchema,
  WebhookReplayRequestSchema,
  WebhookReplayResponseSchema,
  WebhookEndpointCreatedSchema,
  ApiKeySchema,
  ApiKeyCreateSchema,
  ApiKeyCreatedSchema,
  AnalyticsSummarySchema,
  PublicAnalyticsEventSchema,
  PublicAnalyticsEventResponseSchema,
  DomainSchema,
  DomainCreateSchema,
  ExportRequestSchema,
  ProjectPostSchema,
  ProjectPostCreateSchema,
  ProjectPostPatchSchema,
  ProjectTierCreateSchema,
  ProjectTierPatchSchema,
  ProjectGoalSchema,
  ProjectGoalCreateSchema,
  ProjectGoalPatchSchema,
  ProjectGoalPublishSchema,
  ProjectOwnershipSchema,
  ProjectOwnershipRequestSchema,
  ProjectOwnershipTransferRequestSchema,
  ProjectOwnershipTransferSchema,
  ProjectClosureRequestSchema,
  ProjectClosureSchema,
  ProjectOwnershipReviewListSchema,
  ProjectOwnershipReviewDecisionSchema,
  ProjectOwnershipReviewSchema,
  ProjectTeamSchema,
  ProjectTeamInviteCreateSchema,
  ProjectTeamInviteSchema,
  ProjectTeamMemberSchema,
  ProjectTeamMemberPatchSchema,
  ProjectTeamInviteAcceptSchema,
  ProjectPublishSchema,
} from './project-api.js';
import { WebhookEnvelopeSchema } from './webhooks.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const errorResponse = {
  description: 'Problem Details error',
  content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
};

const rateLimitResponse = {
  description: 'Too many requests',
  headers: {
    'Retry-After': {
      description: 'Seconds until another request may be attempted',
      schema: { type: 'integer' as const, minimum: 1 },
    },
    'RateLimit-Limit': {
      description: 'Sustained request limit for this route class',
      schema: { type: 'integer' as const, minimum: 1 },
    },
    'RateLimit-Remaining': {
      description: 'Requests remaining in the current token bucket',
      schema: { type: 'integer' as const, minimum: 0 },
    },
    'RateLimit-Reset': {
      description: 'Seconds until the bucket has capacity again',
      schema: { type: 'integer' as const, minimum: 1 },
    },
    'RateLimit-Policy': {
      description: 'Route-class policy in limit;window and burst form',
      schema: { type: 'string' as const },
    },
  },
  content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
};

registry.register('ProblemDetails', ProblemDetailsSchema);
registry.register('CheckoutIntentRequest', CheckoutIntentRequestSchema);
registry.register('CheckoutIntentResponse', CheckoutIntentResponseSchema);
registry.register('WebhookEnvelope', WebhookEnvelopeSchema);
registry.register('ProjectSummary', ProjectSummarySchema);
registry.register('ProjectListResponse', ProjectListResponseSchema);
registry.register('AccountPreferences', AccountPreferencesSchema);

const sessionCookieSecurity = registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'oss_tips.session_token',
});

const apiKeySecurity = registry.registerComponent('securitySchemes', 'apiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'Authorization',
  description: 'Bearer project API key',
});

function registerPath(
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  opts: {
    tags: string[];
    summary: string;
    request?: RouteConfig['request'];
    responses: Record<string, ResponseConfig>;
    security?: Array<typeof sessionCookieSecurity | typeof apiKeySecurity>;
  },
) {
  const security = opts.security?.map((s) => ({ [s.name]: [] }));
  registry.registerPath({
    method,
    path,
    tags: opts.tags,
    summary: opts.summary,
    ...(opts.request ? { request: opts.request } : {}),
    responses: { ...opts.responses, 429: rateLimitResponse },
    ...(security ? { security } : {}),
  });
}

// Public
registerPath('get', '/api/v1/projects', {
  tags: ['public'],
  summary: 'List projects',
  request: {
    query: z.object({
      query: z.string().optional(),
      tag: z.string().optional(),
      ecosystem: z.string().optional(),
      language: z.string().optional(),
      cursor: ProjectCursorSchema.optional().describe('Opaque keyset cursor'),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Project list',
      content: { 'application/json': { schema: ProjectListResponseSchema } },
    },
    429: errorResponse,
  },
});

registerPath('get', '/api/v1/projects/{slug}', {
  tags: ['public'],
  summary: 'Get project by slug',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: 'Project',
      content: { 'application/json': { schema: ProjectSummarySchema } },
    },
    404: errorResponse,
  },
});

registerPath('post', '/api/v1/projects', {
  tags: ['project'],
  summary: 'Create a project and owner membership',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: ProjectCreateSchema } } },
  },
  responses: {
    201: {
      description: 'Draft project settings',
      content: { 'application/json': { schema: ProjectSettingsSchema } },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('get', '/api/v1/projects/{slug}/tiers', {
  tags: ['public'],
  summary: 'List project tiers',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { description: 'Tiers', content: { 'application/json': { schema: z.array(TierSchema) } } },
  },
});

registerPath('get', '/api/v1/projects/{slug}/goals', {
  tags: ['public'],
  summary: 'List project goals',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { description: 'Goals', content: { 'application/json': { schema: z.array(GoalSchema) } } },
  },
});

registerPath('get', '/api/v1/projects/{slug}/posts', {
  tags: ['public'],
  summary: 'List project posts',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: 'Posts',
      content: { 'application/json': { schema: z.array(PostSummarySchema) } },
    },
  },
});

registerPath('get', '/api/v1/projects/{slug}/posts/{postSlug}', {
  tags: ['public'],
  summary: 'Get project post',
  request: { params: z.object({ slug: z.string(), postSlug: z.string() }) },
  responses: {
    200: { description: 'Post', content: { 'application/json': { schema: PostSummarySchema } } },
    404: errorResponse,
  },
});

registerPath('get', '/api/v1/projects/{slug}/supporters', {
  tags: ['public'],
  summary: 'List public supporters',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: 'Supporters',
      content: { 'application/json': { schema: z.array(PublicSupporterSchema) } },
    },
  },
});

registerPath('post', '/api/v1/projects/{slug}/analytics/events', {
  tags: ['public', 'analytics'],
  summary: 'Record a coarse public analytics event',
  request: {
    params: z.object({ slug: z.string() }),
    body: { content: { 'application/json': { schema: PublicAnalyticsEventSchema } } },
    headers: z.object({ 'idempotency-key': z.string().min(1).max(255) }),
  },
  responses: {
    202: {
      description: 'Event accepted',
      content: { 'application/json': { schema: PublicAnalyticsEventResponseSchema } },
    },
    200: {
      description: 'Duplicate event',
      content: { 'application/json': { schema: PublicAnalyticsEventResponseSchema } },
    },
    404: errorResponse,
  },
});

registerPath('post', '/api/v1/projects/{slug}/checkout-intents', {
  tags: ['public', 'checkout'],
  summary: 'Create checkout intent',
  request: {
    params: z.object({ slug: z.string() }),
    body: { content: { 'application/json': { schema: CheckoutIntentRequestSchema } } },
    headers: z.object({ 'idempotency-key': z.string().min(1).max(255) }),
  },
  responses: {
    201: {
      description: 'Checkout intent',
      content: { 'application/json': { schema: CheckoutIntentResponseSchema } },
    },
    400: errorResponse,
    429: errorResponse,
  },
});

// Supporter
registerPath('get', '/api/v1/me', {
  tags: ['supporter'],
  summary: 'Current user',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Me', content: { 'application/json': { schema: MeSchema } } },
    401: errorResponse,
  },
});

registerPath('get', '/api/v1/me/preferences', {
  tags: ['supporter'],
  summary: 'Current account preferences',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'Account preferences',
      content: { 'application/json': { schema: AccountPreferencesSchema } },
    },
    401: errorResponse,
  },
});

registerPath('patch', '/api/v1/me/preferences', {
  tags: ['supporter'],
  summary: 'Update account preferences',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: AccountPreferencesPatchSchema } } },
  },
  responses: {
    200: {
      description: 'Updated account preferences',
      content: { 'application/json': { schema: AccountPreferencesSchema } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registerPath('get', '/api/v1/me/support', {
  tags: ['supporter'],
  summary: 'Support history',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'Support records',
      content: { 'application/json': { schema: z.array(SupportRecordSchema) } },
    },
  },
});

registerPath('get', '/api/v1/me/memberships', {
  tags: ['supporter'],
  summary: 'Memberships',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'Memberships',
      content: { 'application/json': { schema: z.array(MembershipSchema) } },
    },
  },
});

registerPath('get', '/api/v1/me/entitlements', {
  tags: ['supporter'],
  summary: 'Entitlements',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'Entitlements',
      content: { 'application/json': { schema: z.array(EntitlementSchema) } },
    },
  },
});

registerPath('get', '/api/v1/me/inbox', {
  tags: ['supporter'],
  summary: 'Inbox threads',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'Threads',
      content: { 'application/json': { schema: z.array(InboxThreadSchema) } },
    },
  },
});

registerPath('patch', '/api/v1/me/memberships/{id}', {
  tags: ['supporter'],
  summary: 'Update membership billing preference',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: MembershipPatchSchema,
        },
      },
    },
    headers: z.object({ 'idempotency-key': z.string().min(1).max(255) }).partial(),
  },
  responses: {
    200: {
      description: 'Membership',
      content: { 'application/json': { schema: MembershipSchema } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
    409: errorResponse,
    502: errorResponse,
    503: errorResponse,
  },
});

registerPath('post', '/api/v1/me/threads/{id}/messages', {
  tags: ['supporter'],
  summary: 'Send supporter message',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ThreadMessageCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Message',
      content: { 'application/json': { schema: ThreadMessageSchema } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registerPath('patch', '/api/v1/me/public-support/{paymentId}', {
  tags: ['supporter'],
  summary: 'Update public support preferences',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ paymentId: z.string() }),
    body: { content: { 'application/json': { schema: PublicSupportPatchSchema } } },
  },
  responses: {
    200: {
      description: 'Updated preferences',
      content: { 'application/json': { schema: PublicSupportPatchSchema } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registerPath('post', '/api/v1/me/discord/link', {
  tags: ['supporter'],
  summary: 'Start Discord linking',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: DiscordLinkRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Discord authorization URL',
      content: { 'application/json': { schema: DiscordLinkSchema } },
    },
    401: errorResponse,
  },
});

registerPath('delete', '/api/v1/me/discord/link', {
  tags: ['supporter'],
  summary: 'Remove Discord link',
  security: [sessionCookieSecurity],
  responses: { 204: { description: 'Discord link removed' }, 401: errorResponse },
});

// Project
registerPath('get', '/api/v1/project', {
  tags: ['project'],
  summary: 'Project settings',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Settings',
      content: { 'application/json': { schema: ProjectSettingsSchema } },
    },
  },
});

registerPath('put', '/api/v1/project', {
  tags: ['project'],
  summary: 'Update project settings',
  security: [sessionCookieSecurity],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ProjectSettingsPatchSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Settings',
      content: { 'application/json': { schema: ProjectSettingsSchema } },
    },
    403: errorResponse,
  },
});

registerPath('delete', '/api/v1/project', {
  tags: ['project'],
  summary: 'Close a project without deleting its financial history',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: ProjectClosureRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Project closed',
      content: { 'application/json': { schema: ProjectClosureSchema } },
    },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('get', '/api/v1/project/tiers', {
  tags: ['project'],
  summary: 'List project tiers',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: { description: 'Tiers', content: { 'application/json': { schema: z.array(TierSchema) } } },
  },
});

registerPath('post', '/api/v1/project/tiers', {
  tags: ['project'],
  summary: 'Create project tier',
  security: [sessionCookieSecurity],
  request: { body: { content: { 'application/json': { schema: ProjectTierCreateSchema } } } },
  responses: {
    201: { description: 'Tier', content: { 'application/json': { schema: TierSchema } } },
    403: errorResponse,
  },
});

registerPath('patch', '/api/v1/project/tiers/{id}', {
  tags: ['project'],
  summary: 'Update project tier',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProjectTierPatchSchema } } },
  },
  responses: {
    200: { description: 'Tier', content: { 'application/json': { schema: TierSchema } } },
    403: errorResponse,
  },
});

registerPath('delete', '/api/v1/project/tiers/{id}', {
  tags: ['project'],
  summary: 'Archive project tier',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: { 204: { description: 'Tier archived' }, 403: errorResponse, 404: errorResponse },
});

registerPath('get', '/api/v1/project/posts', {
  tags: ['project'],
  summary: 'List project posts',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Posts',
      content: { 'application/json': { schema: z.array(ProjectPostSchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/posts', {
  tags: ['project'],
  summary: 'Create project post',
  security: [sessionCookieSecurity],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ProjectPostCreateSchema,
        },
      },
    },
  },
  responses: {
    201: { description: 'Post', content: { 'application/json': { schema: ProjectPostSchema } } },
    403: errorResponse,
  },
});

registerPath('patch', '/api/v1/project/posts/{id}', {
  tags: ['project'],
  summary: 'Update project post',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ProjectPostPatchSchema,
        },
      },
    },
  },
  responses: {
    200: { description: 'Post', content: { 'application/json': { schema: ProjectPostSchema } } },
    403: errorResponse,
  },
});

registerPath('post', '/api/v1/project/posts/{id}/publish', {
  tags: ['project'],
  summary: 'Publish project post',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: { 202: { description: 'Publish queued' }, 403: errorResponse },
});

registerPath('get', '/api/v1/project/goals', {
  tags: ['project'],
  summary: 'List project goals',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Goals',
      content: { 'application/json': { schema: z.array(ProjectGoalSchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/goals', {
  tags: ['project'],
  summary: 'Create project goal',
  security: [sessionCookieSecurity],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ProjectGoalCreateSchema,
        },
      },
    },
  },
  responses: {
    201: { description: 'Goal', content: { 'application/json': { schema: ProjectGoalSchema } } },
    403: errorResponse,
  },
});

registerPath('patch', '/api/v1/project/goals/{id}', {
  tags: ['project'],
  summary: 'Update project goal',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProjectGoalPatchSchema } } },
  },
  responses: {
    200: { description: 'Goal', content: { 'application/json': { schema: ProjectGoalSchema } } },
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('delete', '/api/v1/project/goals/{id}', {
  tags: ['project'],
  summary: 'Archive project goal',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: { 204: { description: 'Goal archived' }, 403: errorResponse, 404: errorResponse },
});

registerPath('post', '/api/v1/project/goals/{id}/publish', {
  tags: ['project'],
  summary: 'Publish project goal',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProjectGoalPublishSchema } } },
  },
  responses: {
    200: { description: 'Goal', content: { 'application/json': { schema: ProjectGoalSchema } } },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('get', '/api/v1/project/ownership', {
  tags: ['project'],
  summary: 'Get project ownership verification state',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Ownership state',
      content: { 'application/json': { schema: ProjectOwnershipSchema } },
    },
    403: errorResponse,
  },
});

registerPath('post', '/api/v1/project/ownership', {
  tags: ['project'],
  summary: 'Request project ownership verification',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: ProjectOwnershipRequestSchema } } },
  },
  responses: {
    202: {
      description: 'Verification pending',
      content: { 'application/json': { schema: ProjectOwnershipSchema } },
    },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('post', '/api/v1/project/ownership/transfer', {
  tags: ['project'],
  summary: 'Transfer project ownership to a verified team member',
  security: [sessionCookieSecurity],
  request: {
    body: { content: { 'application/json': { schema: ProjectOwnershipTransferRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Ownership transferred',
      content: { 'application/json': { schema: ProjectOwnershipTransferSchema } },
    },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('post', '/api/v1/project/support-email/verification', {
  tags: ['project'],
  summary: 'Send or confirm project support-email verification',
  security: [sessionCookieSecurity],
  request: {
    body: {
      content: { 'application/json': { schema: ProjectSupportEmailVerificationRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Verified support email',
      content: { 'application/json': { schema: ProjectSupportEmailVerificationSchema } },
    },
    202: {
      description: 'Verification email sent',
      content: { 'application/json': { schema: ProjectSupportEmailVerificationSchema } },
    },
    400: errorResponse,
    403: errorResponse,
    429: errorResponse,
    503: errorResponse,
  },
});

registerPath('post', '/api/v1/project/publish', {
  tags: ['project'],
  summary: 'Publish project after eligibility checks',
  security: [sessionCookieSecurity],
  request: { body: { content: { 'application/json': { schema: ProjectPublishSchema } } } },
  responses: {
    200: {
      description: 'Published project settings',
      content: { 'application/json': { schema: ProjectSettingsSchema } },
    },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('get', '/api/v1/project/team', {
  tags: ['project'],
  summary: 'List project team members and invitations',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Team', content: { 'application/json': { schema: ProjectTeamSchema } } },
    403: errorResponse,
  },
});

registerPath('post', '/api/v1/project/team', {
  tags: ['project'],
  summary: 'Invite project team member',
  security: [sessionCookieSecurity],
  request: { body: { content: { 'application/json': { schema: ProjectTeamInviteCreateSchema } } } },
  responses: {
    201: {
      description: 'Invitation',
      content: { 'application/json': { schema: ProjectTeamInviteSchema } },
    },
    403: errorResponse,
    409: errorResponse,
  },
});

registerPath('patch', '/api/v1/project/team/{id}', {
  tags: ['project'],
  summary: 'Update project team member',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProjectTeamMemberPatchSchema } } },
  },
  responses: {
    200: {
      description: 'Team member',
      content: { 'application/json': { schema: ProjectTeamMemberSchema } },
    },
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('delete', '/api/v1/project/team/{id}', {
  tags: ['project'],
  summary: 'Remove project team member',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Team member removed' },
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('post', '/api/v1/project/team/invites/{id}/accept', {
  tags: ['project'],
  summary: 'Accept project team invitation',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Invitation accepted',
      content: { 'application/json': { schema: ProjectTeamInviteAcceptSchema } },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('get', '/api/v1/admin/project-claims', {
  tags: ['admin'],
  summary: 'List project ownership claims for review',
  security: [sessionCookieSecurity],
  request: {
    query: z.object({
      status: z.enum(['pending', 'manual_review', 'rejected', 'verified']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Ownership claims',
      content: { 'application/json': { schema: ProjectOwnershipReviewListSchema } },
    },
    401: errorResponse,
    403: errorResponse,
  },
});

registerPath('patch', '/api/v1/admin/project-claims/{id}', {
  tags: ['admin'],
  summary: 'Approve, reject, or hold project ownership claim',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProjectOwnershipReviewDecisionSchema } } },
  },
  responses: {
    200: {
      description: 'Updated ownership claim',
      content: { 'application/json': { schema: ProjectOwnershipReviewSchema } },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
});

registerPath('get', '/api/v1/project/supporters', {
  tags: ['project'],
  summary: 'List project supporters',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Supporters',
      content: { 'application/json': { schema: z.array(PublicSupporterSchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/payments/{id}/refund', {
  tags: ['project'],
  summary: 'Refund payment',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: RefundRequestSchema } } },
  },
  responses: {
    202: { description: 'Refund accepted' },
    403: errorResponse,
  },
});

registerPath('get', '/api/v1/project/analytics', {
  tags: ['project'],
  summary: 'Analytics summary',
  security: [sessionCookieSecurity, apiKeySecurity],
  request: {
    query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }),
  },
  responses: {
    200: {
      description: 'Analytics',
      content: { 'application/json': { schema: AnalyticsSummarySchema } },
    },
  },
});

registerPath('post', '/api/v1/project/exports', {
  tags: ['project'],
  summary: 'Queue project export',
  security: [sessionCookieSecurity],
  request: { body: { content: { 'application/json': { schema: ExportRequestSchema } } } },
  responses: { 202: { description: 'Export queued' }, 403: errorResponse },
});

registerPath('get', '/api/v1/project/webhooks', {
  tags: ['project'],
  summary: 'List webhook endpoints',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Endpoints',
      content: { 'application/json': { schema: z.array(WebhookEndpointSchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/webhooks', {
  tags: ['project'],
  summary: 'Create webhook endpoint',
  security: [sessionCookieSecurity, apiKeySecurity],
  request: { body: { content: { 'application/json': { schema: WebhookEndpointCreateSchema } } } },
  responses: {
    201: {
      description: 'Webhook endpoint and secret',
      content: { 'application/json': { schema: WebhookEndpointCreatedSchema } },
    },
    400: errorResponse,
    403: errorResponse,
  },
});

registerPath('patch', '/api/v1/project/webhooks/{id}', {
  tags: ['project'],
  summary: 'Enable or disable webhook endpoint',
  security: [sessionCookieSecurity, apiKeySecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: WebhookEndpointPatchSchema } } },
  },
  responses: {
    200: {
      description: 'Updated webhook endpoint',
      content: { 'application/json': { schema: WebhookEndpointSchema } },
    },
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('delete', '/api/v1/project/webhooks/{id}', {
  tags: ['project'],
  summary: 'Disable webhook endpoint',
  security: [sessionCookieSecurity, apiKeySecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Webhook endpoint disabled' },
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('post', '/api/v1/project/webhooks/{id}/replay', {
  tags: ['project'],
  summary: 'Replay a webhook delivery',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: WebhookReplayRequestSchema } } },
  },
  responses: {
    202: {
      description: 'Webhook replay queued',
      content: { 'application/json': { schema: WebhookReplayResponseSchema } },
    },
    403: errorResponse,
    404: errorResponse,
  },
});

registerPath('get', '/api/v1/project/api-keys', {
  tags: ['project'],
  summary: 'List API keys',
  security: [sessionCookieSecurity],
  responses: {
    200: {
      description: 'API keys',
      content: { 'application/json': { schema: z.array(ApiKeySchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/api-keys', {
  tags: ['project'],
  summary: 'Create project API key',
  security: [sessionCookieSecurity],
  request: { body: { content: { 'application/json': { schema: ApiKeyCreateSchema } } } },
  responses: {
    201: {
      description: 'API key and secret',
      content: { 'application/json': { schema: ApiKeyCreatedSchema } },
    },
    403: errorResponse,
  },
});

registerPath('delete', '/api/v1/project/api-keys/{id}', {
  tags: ['project'],
  summary: 'Revoke project API key',
  security: [sessionCookieSecurity],
  request: { params: z.object({ id: z.string() }) },
  responses: { 204: { description: 'API key revoked' }, 403: errorResponse, 404: errorResponse },
});

registerPath('get', '/api/v1/project/domains', {
  tags: ['project'],
  summary: 'List project domains',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: {
      description: 'Domains',
      content: { 'application/json': { schema: z.array(DomainSchema) } },
    },
  },
});

registerPath('post', '/api/v1/project/domains', {
  tags: ['project'],
  summary: 'Request project domain',
  security: [sessionCookieSecurity],
  request: {
    body: {
      content: {
        'application/json': {
          schema: DomainCreateSchema,
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Domain validation queued',
      content: { 'application/json': { schema: DomainSchema } },
    },
    400: errorResponse,
    403: errorResponse,
  },
});

registerPath('post', '/api/v1/project/threads/{id}/messages', {
  tags: ['project'],
  summary: 'Reply to supporter thread',
  security: [sessionCookieSecurity],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ body: z.string().min(1).max(2000) }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Message',
      content: { 'application/json': { schema: ThreadMessageSchema } },
    },
    403: errorResponse,
    404: errorResponse,
  },
});

export function generateOpenApiDocument(): OpenAPIObject {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'oss.tips API',
      version: '1.0.0',
      description: 'REST/JSON API for oss.tips public, supporter, and project endpoints.',
    },
    servers: [{ url: 'https://oss.tips' }],
    tags: [
      { name: 'public' },
      { name: 'supporter' },
      { name: 'project' },
      { name: 'admin' },
      { name: 'checkout' },
    ],
  });
  const components = generator.generateComponents();
  return { ...doc, components: { ...doc.components, ...components.components } };
}
