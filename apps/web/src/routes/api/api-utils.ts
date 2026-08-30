import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import {
  apiKeyPrefix,
  encryptWebhookSecret,
  hashForEtag,
  verifyApiKeySecret,
} from '@oss-tips/api-contracts/security';
import {
  checkWebhookDestination as checkDestination,
  isBlockedIp,
} from '@oss-tips/api-contracts/webhook-destination';
import { checkProject, type ProjectCapability, type Actor } from '@oss-tips/auth';
import { uuidv7 } from '@oss-tips/domain';
import {
  API_RATE_LIMITS,
  createApiRateLimitsRepository,
  type ApiRateLimitDecision,
  type Db,
  type JsonValue,
  type NewAuditEvent,
} from '@oss-tips/db';
import type { RequestEvent } from '@sveltejs/kit';
import { json, problem } from '$lib/server/http';

export type ApiEvent = Pick<RequestEvent, 'request' | 'url' | 'locals'>;

export { json, problem } from '$lib/server/http';

export type ApiKeyPrincipal = {
  kind: 'api_key';
  projectId: string;
  scopes: ReadonlySet<string>;
  keyId: string;
  rateLimitKey: string;
};

export type ProjectPrincipal =
  | { source: 'api_key'; actor: ApiKeyPrincipal; projectId: string }
  | { source: 'session'; actor: Actor; projectId: string; userId: string };

export type AuditActor = {
  type: 'api_key' | 'user' | 'guest';
  userId?: string | null;
  /** Optional non-user actor identifier, such as an API key id. */
  id?: string | null;
};

type RateLimitPrincipal = {
  kind: 'api_key' | 'session';
  key: string;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isUnsafeMethod(request: Request): boolean {
  return UNSAFE_METHODS.has(request.method.toUpperCase());
}

/** Hash credentials before they become durable rate-limit keys. */
export function apiRateLimitSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.API_RATE_LIMIT_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') {
    throw new Error('API_RATE_LIMIT_SECRET is required in production');
  }
  return env.BETTER_AUTH_SECRET?.trim() || 'oss-tips-rate-limit-development-only';
}

export function hashApiRateLimitKey(value: string, env: NodeJS.ProcessEnv = process.env): string {
  const secret = apiRateLimitSecret(env);
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

function rateLimitPolicy(event: ApiEvent, principal: RateLimitPrincipal) {
  if (/\/webhooks\/[^/]+\/replay$/.test(event.url.pathname)) {
    return { routeClass: 'webhook.replay', policy: API_RATE_LIMITS.webhookReplay };
  }
  if (principal.kind === 'api_key') {
    if (/\/analytics$/.test(event.url.pathname)) {
      return { routeClass: 'api-key.analytics', policy: API_RATE_LIMITS.apiKeyAnalytics };
    }
    if (/\/exports(?:\/|$)/.test(event.url.pathname)) {
      return { routeClass: 'api-key.export', policy: API_RATE_LIMITS.apiKeyExport };
    }
    return { routeClass: 'api-key', policy: API_RATE_LIMITS.apiKey };
  }
  return isUnsafeMethod(event.request)
    ? { routeClass: 'session.mutation', policy: API_RATE_LIMITS.sessionMutation }
    : { routeClass: 'session.read', policy: API_RATE_LIMITS.sessionRead };
}

export function apiRateLimitHeaders(decision: ApiRateLimitDecision): Headers {
  return new Headers({
    'ratelimit-limit': String(decision.limit),
    'ratelimit-remaining': String(decision.remaining),
    'ratelimit-reset': String(decision.retryAfterSeconds),
    'ratelimit-policy': `${decision.limit};w=${decision.windowSeconds};burst=${decision.burst}`,
    ...(decision.allowed ? {} : { 'retry-after': String(decision.retryAfterSeconds) }),
  });
}

export function apiRateLimitResponse(decision: ApiRateLimitDecision): Response {
  return problem(429, 'Too many requests', 'Please retry after the rate limit window resets', {
    headers: apiRateLimitHeaders(decision),
  });
}

/**
 * Enforce a durable bucket after authentication and authorization succeed.
 * Mutations fail closed if the limiter store is unavailable; reads may continue
 * so a limiter outage does not turn public dashboards into a write surface.
 */
export async function enforceApiRateLimit(
  event: ApiEvent,
  db: Db,
  principal: RateLimitPrincipal,
): Promise<Response | null> {
  const { routeClass, policy } = rateLimitPolicy(event, principal);
  try {
    const decision = await createApiRateLimitsRepository(db).consume({
      keyHash: principal.key,
      routeClass,
      policy,
    });
    return decision.allowed ? null : apiRateLimitResponse(decision);
  } catch (error) {
    console.error('[api] rate limiter unavailable', { routeClass, error });
    return isUnsafeMethod(event.request)
      ? problem(
          503,
          'Rate limiter unavailable',
          'Authenticated mutations are temporarily unavailable',
        )
      : null;
  }
}

/** Shared first-party supporter boundary; project routes call authorizeProject below. */
export async function enforceSupporterRateLimit(event: ApiEvent, db: Db): Promise<Response | null> {
  const session = event.locals.session;
  if (!session || !/^\/api\/v1\/me(?:\/|$)/.test(event.url.pathname)) return null;
  return enforceApiRateLimit(event, db, {
    kind: 'session',
    key: hashApiRateLimitKey(`session:${session.user.id}`),
  });
}

export const AUDIT_METADATA_ALLOWLIST = [
  'amount_minor',
  'asset_id',
  'attempt_count',
  'cadence',
  'cancel_at_period_end',
  'capabilities',
  'case_from_status',
  'case_id',
  'case_to_status',
  'change',
  'confirmed',
  'content_length',
  'content_type',
  'currency',
  'delivery_id',
  'discord_user_id',
  'enabled',
  'email_domain',
  'endpoint_id',
  'events',
  'fields',
  'format',
  'from_project_status',
  'from_status',
  'goal_type',
  'job_id',
  'kind',
  'member_id',
  'method',
  'original_delivery_id',
  'platform_tip_minor',
  'post_id',
  'project_amount_minor',
  'project_id',
  'purpose',
  'organisation_id',
  'refund_id',
  'report_created',
  'retry_after_seconds',
  'review_status',
  'role',
  'scheduled',
  'scheduled_at',
  'scope',
  'scopes',
  'show_amount',
  'show_name',
  'show_message',
  'slug',
  'status',
  'stripe_account_id',
  'to_project_status',
  'to_status',
  'user_id',
  'visibility',
  'repository_provider',
] as const;

const auditMetadataKeys = new Set<string>(AUDIT_METADATA_ALLOWLIST);

function safeAuditMetadataValue(value: JsonValue): JsonValue | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.length <= 256 ? value : undefined;
  if (!Array.isArray(value)) return undefined;
  const items = value.slice(0, 32).map(safeAuditMetadataValue);
  return items.every((item) => item !== undefined)
    ? (items as JsonValue[])
    : items.filter((item): item is JsonValue => item !== undefined);
}

function redactAuditMetadata(value: JsonValue | undefined): JsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'reason' || !auditMetadataKeys.has(key)) continue;
    const safe = safeAuditMetadataValue(item);
    if (safe !== undefined) result[key] = safe;
  }
  return result;
}

function auditReason(value: JsonValue | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\r\n]+/g, ' ');
  return normalized ? normalized.slice(0, 500) : null;
}

export function getAuditHashSecret(): string {
  const secret = process.env.AUDIT_HASH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUDIT_HASH_SECRET is required in production');
  }
  return secret ?? 'oss-tips-audit-development-only';
}

export function hashAuditIp(ip: string): string {
  return createHmac('sha256', getAuditHashSecret()).update(ip, 'utf8').digest('hex');
}

function correlationId(event: ApiEvent, requested: string | null | undefined): string {
  const candidate =
    requested ??
    event.request.headers.get('x-correlation-id') ??
    event.request.headers.get('x-request-id');
  return candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : uuidv7();
}

export function auditRecord(
  event: ApiEvent,
  actor: AuditActor,
  values: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    projectId?: string | null;
    reason?: string | null;
    sessionId?: string | null;
    beforeHash?: string | null;
    afterHash?: string | null;
    correlationId?: string | null;
    metadata?: JsonValue;
  },
): NewAuditEvent {
  const forwardedIp = event.request.headers.get('cf-connecting-ip')?.trim();
  const auditHashSecret = getAuditHashSecret();
  const metadata = values.metadata;
  const metadataReason =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata.reason
      : undefined;
  return {
    id: uuidv7(),
    actor_id: actor.id ?? actor.userId ?? null,
    actor_type: actor.type,
    session_id: values.sessionId ?? event.locals.session?.session?.id ?? null,
    action: values.action,
    resource_type: values.resourceType,
    resource_id: values.resourceId ?? null,
    project_id: values.projectId ?? null,
    reason: auditReason(values.reason ?? metadataReason),
    ip_hash: forwardedIp
      ? createHmac('sha256', auditHashSecret).update(forwardedIp, 'utf8').digest('hex')
      : null,
    before_hash: values.beforeHash ?? null,
    after_hash: values.afterHash ?? null,
    correlation_id: correlationId(event, values.correlationId),
    metadata_redacted: redactAuditMetadata(metadata),
  };
}

export function requireSession(event: ApiEvent): { userId: string } | Response {
  if (!event.locals.session) return problem(401, 'Authentication required');
  return { userId: event.locals.session.user.id };
}

export function publicBaseUrl(url: URL): string {
  return (process.env.PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`).replace(/\/$/, '');
}

export function jsonWithEtag(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
  cacheControl = 'public, max-age=60, stale-while-revalidate=300',
): Response {
  const serialized = JSON.stringify(body);
  const etag = hashForEtag(serialized);
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('etag', etag);
  headers.set('cache-control', cacheControl);
  const requested = request.headers.get('if-none-match');
  if (requested === '*' || requested?.split(',').some((item) => item.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(serialized, { ...init, headers });
}

export function parsePage(url: URL): { limit: number; cursor?: string } | Response {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return problem(400, 'Invalid pagination limit', 'limit must be an integer between 1 and 100');
  }
  const cursor = url.searchParams.get('cursor') ?? undefined;
  if (cursor && (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 256)) {
    return problem(400, 'Invalid pagination cursor', 'cursor must be an opaque keyset cursor');
  }
  return cursor ? { limit, cursor } : { limit };
}

/** Maximum decoded request size for JSON API mutations. */
export const JSON_BODY_MAX_BYTES = 256 * 1024;

function contentLength(request: Request): number | Response | undefined {
  const raw = request.headers.get('content-length');
  if (raw === null) return undefined;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return problem(400, 'Invalid Content-Length', 'Content-Length must be a non-negative integer');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return problem(400, 'Invalid Content-Length', 'Content-Length must be a safe integer');
  }
  return parsed;
}

async function readBoundedRequestBody(
  request: Request,
  maxBytes = JSON_BODY_MAX_BYTES,
): Promise<Uint8Array | Response> {
  const declared = contentLength(request);
  if (declared instanceof Response) return declared;
  if (declared !== undefined && declared > maxBytes) {
    return problem(413, 'Request body too large', `Request body must be ${maxBytes} bytes or less`);
  }

  if (!request.body) {
    if (declared !== undefined && declared !== 0) {
      return problem(400, 'Request body length mismatch', 'Content-Length does not match body');
    }
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value ?? new Uint8Array();
      total += chunk.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The body is already oversized; preserve 413 even if cancellation fails.
        }
        return problem(
          413,
          'Request body too large',
          `Request body must be ${maxBytes} bytes or less`,
        );
      }
      chunks.push(chunk);
    }
  } catch {
    return problem(400, 'Invalid request body');
  } finally {
    reader.releaseLock();
  }

  if (declared !== undefined && declared !== total) {
    return problem(400, 'Request body length mismatch', 'Content-Length does not match body');
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonText(request: Request): Promise<string | Response> {
  const body = await readBoundedRequestBody(request);
  if (body instanceof Response) return body;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return problem(400, 'Invalid JSON body');
  }
}

export async function readJsonValue(request: Request): Promise<unknown | Response> {
  const text = await readJsonText(request);
  if (text instanceof Response) return text;
  try {
    return JSON.parse(text);
  } catch {
    return problem(400, 'Invalid JSON body');
  }
}

export async function readJson<T>(
  request: Request,
  schema: {
    safeParse(
      value: unknown,
    ): { success: true; data: T } | { success: false; error: { message: string } };
  },
): Promise<T | Response> {
  const body = await readJsonValue(request);
  if (body instanceof Response) return body;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return problem(400, 'Invalid request', parsed.error.message);
  return parsed.data;
}

async function authenticateApiKey(
  db: Db,
  request: Request,
): Promise<ApiKeyPrincipal | Response | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer\s+(oss_sk_[A-Za-z0-9_-]{32,})$/.exec(authorization.trim());
  if (!match?.[1]) return problem(401, 'Invalid API key', 'Use a Bearer project API key');
  const secret = match[1];
  const now = new Date();
  const rows = await db
    .selectFrom('api_key')
    .select(['id', 'project_id', 'key_hash', 'scopes'])
    .where('key_prefix', '=', apiKeyPrefix(secret))
    .where('revoked_at', 'is', null)
    .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
    .execute();
  const row = rows.find((candidate) => verifyApiKeySecret(secret, candidate.key_hash));
  if (!row) {
    return problem(401, 'Invalid API key', 'The key is invalid, revoked, or expired');
  }
  void db
    .updateTable('api_key')
    .set({ last_used_at: now })
    .where('id', '=', row.id)
    .execute()
    .catch(() => undefined);
  return {
    kind: 'api_key',
    projectId: row.project_id,
    scopes: new Set(row.scopes),
    keyId: row.id,
    rateLimitKey: hashApiRateLimitKey(`api-key:${secret}`),
  };
}

export async function authorizeProject(
  event: ApiEvent,
  db: Db,
  capability: ProjectCapability,
  apiScope: string,
  allowClosed = false,
): Promise<ProjectPrincipal | Response> {
  try {
    const apiKey = await authenticateApiKey(db, event.request);
    if (apiKey instanceof Response) return apiKey;
    if (apiKey) {
      if (!apiKey.scopes.has(apiScope)) {
        return problem(403, 'Insufficient API key scope', `Required scope: ${apiScope}`);
      }
      const rateLimit = await enforceApiRateLimit(event, db, {
        kind: 'api_key',
        key: apiKey.rateLimitKey,
      });
      if (rateLimit) return rateLimit;
      if (isUnsafeMethod(event.request) && !allowClosed) {
        const project = await db
          .selectFrom('project')
          .select(['id', 'status'])
          .where('id', '=', apiKey.projectId)
          .executeTakeFirst();
        if (!project) return problem(404, 'Project not found');
        if (project.status === 'closed') {
          return problem(409, 'Project is closed', 'Closed projects do not accept mutations');
        }
      }
      return { source: 'api_key', actor: apiKey, projectId: apiKey.projectId };
    }

    const session = event.locals.session;
    const actor = event.locals.actor;
    if (!session || !actor) return problem(401, 'Authentication required');
    let projectId =
      event.request.headers.get('x-project-id')?.trim() ||
      event.url.searchParams.get('project_id')?.trim();
    if (!projectId) {
      const slug =
        event.request.headers.get('x-project-slug')?.trim() ||
        event.url.searchParams.get('project_slug')?.trim();
      if (slug) {
        projectId = (
          await db.selectFrom('project').select('id').where('slug', '=', slug).executeTakeFirst()
        )?.id;
      }
    }
    if (!projectId)
      return problem(
        400,
        'Project context required',
        'Send X-Project-Id for session-authenticated requests',
      );
    const decision = checkProject(actor, capability, projectId);
    if (!decision.allowed) return problem(403, 'Project access denied', decision.reason);
    if (isUnsafeMethod(event.request) && !allowClosed) {
      const project = await db
        .selectFrom('project')
        .select(['id', 'status'])
        .where('id', '=', projectId)
        .executeTakeFirst();
      if (!project) return problem(404, 'Project not found');
      if (project.status === 'closed') {
        return problem(409, 'Project is closed', 'Closed projects do not accept mutations');
      }
    }
    const rateLimit = await enforceApiRateLimit(event, db, {
      kind: 'session',
      key: hashApiRateLimitKey(`session:${session.user.id}`),
    });
    if (rateLimit) return rateLimit;
    return { source: 'session', actor, projectId, userId: session.user.id };
  } catch (error) {
    console.error('[api] authorization database unavailable', error);
    return problem(
      503,
      'Database unavailable',
      'Authenticated API requests are temporarily unavailable',
    );
  }
}

export function getWebhookEncryptionKey(): string | Response {
  const key = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!key)
    return problem(503, 'Webhook secrets unavailable', 'WEBHOOK_ENCRYPTION_KEY is required');
  return key;
}

export function encryptWebhookSecretForStorage(secret: string): string | Response {
  const key = getWebhookEncryptionKey();
  if (key instanceof Response) return key;
  try {
    return encryptWebhookSecret(secret, key);
  } catch {
    return problem(
      503,
      'Webhook secrets unavailable',
      'WEBHOOK_ENCRYPTION_KEY must decode to 32 bytes',
    );
  }
}

export async function validateWebhookUrl(
  value: string,
): Promise<{ url: URL } | { error: Response }> {
  const checked = checkDestination(value);
  if (!checked.ok) return { error: problem(400, 'Invalid webhook URL', checked.reason) };
  try {
    const addresses = await lookup(checked.url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
      return {
        error: problem(400, 'Invalid webhook URL', 'Webhook URL resolves to a private address'),
      };
    }
  } catch {
    return { error: problem(400, 'Invalid webhook URL', 'Webhook hostname could not be resolved') };
  }
  return { url: checked.url };
}
