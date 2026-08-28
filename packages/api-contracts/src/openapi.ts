import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { ResponseConfig, RouteConfig } from '@asteasolutions/zod-to-openapi/dist/openapi-registry.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { z } from 'zod';
import { CheckoutIntentRequestSchema, CheckoutIntentResponseSchema } from './checkout.js';
import { ProblemDetailsSchema } from './problem.js';
import {
  ProjectListResponseSchema,
  ProjectSummarySchema,
  TierSchema,
  GoalSchema,
  PostSummarySchema,
  PublicSupporterSchema,
} from './projects.js';
import {
  MeSchema,
  SupportRecordSchema,
  MembershipSchema,
  EntitlementSchema,
  InboxThreadSchema,
} from './supporter.js';
import {
  ProjectSettingsSchema,
  RefundRequestSchema,
  WebhookEndpointSchema,
  ApiKeySchema,
  AnalyticsSummarySchema,
} from './project-api.js';
import { WebhookEnvelopeSchema } from './webhooks.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const errorResponse = {
  description: 'Problem Details error',
  content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
};

registry.register('ProblemDetails', ProblemDetailsSchema);
registry.register('CheckoutIntentRequest', CheckoutIntentRequestSchema);
registry.register('CheckoutIntentResponse', CheckoutIntentResponseSchema);
registry.register('WebhookEnvelope', WebhookEnvelopeSchema);
registry.register('ProjectSummary', ProjectSummarySchema);
registry.register('ProjectListResponse', ProjectListResponseSchema);

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
    responses: opts.responses,
    ...(security ? { security } : {}),
  });
}

// Public
registerPath('get', '/api/v1/projects', {
  tags: ['public'],
  summary: 'List projects',
  responses: {
    200: { description: 'Project list', content: { 'application/json': { schema: ProjectListResponseSchema } } },
    429: errorResponse,
  },
});

registerPath('get', '/api/v1/projects/{slug}', {
  tags: ['public'],
  summary: 'Get project by slug',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { description: 'Project', content: { 'application/json': { schema: ProjectSummarySchema } } },
    404: errorResponse,
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
    200: { description: 'Posts', content: { 'application/json': { schema: z.array(PostSummarySchema) } } },
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
    200: { description: 'Supporters', content: { 'application/json': { schema: z.array(PublicSupporterSchema) } } },
  },
});

registerPath('post', '/api/v1/projects/{slug}/checkout-intents', {
  tags: ['public', 'checkout'],
  summary: 'Create checkout intent',
  request: {
    params: z.object({ slug: z.string() }),
    body: { content: { 'application/json': { schema: CheckoutIntentRequestSchema } } },
    headers: z.object({ 'idempotency-key': z.string().optional() }),
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

registerPath('get', '/api/v1/me/support', {
  tags: ['supporter'],
  summary: 'Support history',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Support records', content: { 'application/json': { schema: z.array(SupportRecordSchema) } } },
  },
});

registerPath('get', '/api/v1/me/memberships', {
  tags: ['supporter'],
  summary: 'Memberships',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Memberships', content: { 'application/json': { schema: z.array(MembershipSchema) } } },
  },
});

registerPath('get', '/api/v1/me/entitlements', {
  tags: ['supporter'],
  summary: 'Entitlements',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Entitlements', content: { 'application/json': { schema: z.array(EntitlementSchema) } } },
  },
});

registerPath('get', '/api/v1/me/inbox', {
  tags: ['supporter'],
  summary: 'Inbox threads',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Threads', content: { 'application/json': { schema: z.array(InboxThreadSchema) } } },
  },
});

// Project
registerPath('get', '/api/v1/project', {
  tags: ['project'],
  summary: 'Project settings',
  security: [sessionCookieSecurity, apiKeySecurity],
  responses: {
    200: { description: 'Settings', content: { 'application/json': { schema: ProjectSettingsSchema } } },
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
  responses: {
    200: { description: 'Analytics', content: { 'application/json': { schema: AnalyticsSummarySchema } } },
  },
});

registerPath('get', '/api/v1/project/webhooks', {
  tags: ['project'],
  summary: 'List webhook endpoints',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'Endpoints', content: { 'application/json': { schema: z.array(WebhookEndpointSchema) } } },
  },
});

registerPath('get', '/api/v1/project/api-keys', {
  tags: ['project'],
  summary: 'List API keys',
  security: [sessionCookieSecurity],
  responses: {
    200: { description: 'API keys', content: { 'application/json': { schema: z.array(ApiKeySchema) } } },
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
      { name: 'checkout' },
    ],
  });
  const components = generator.generateComponents();
  return { ...doc, components: { ...doc.components, ...components.components } };
}
