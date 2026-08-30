import { ApiKeyCreateSchema, ApiKeyCreatedSchema, ApiKeySchema } from '@oss-tips/api-contracts';
import {
  apiKeyPrefix,
  createApiKeySecret,
  hashApiKeySecret,
} from '@oss-tips/api-contracts/security';
import { emailNotificationJob } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';

const ALLOWED_SCOPES = new Set([
  'project:read',
  'posts:read',
  'posts:write',
  'tiers:read',
  'goals:read',
  'goals:write',
  'supporters:read',
  'analytics:read',
  'webhooks:manage',
]);

function endpointPayload(row: {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
}) {
  return ApiKeySchema.parse({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    scopes: row.scopes,
    created_at: row.created_at.toISOString(),
    last_used_at: row.last_used_at?.toISOString() ?? null,
    expires_at: row.expires_at?.toISOString() ?? null,
  });
}

async function authorize(event: Parameters<RequestHandler>[0]) {
  const db = getDb();
  const principal = await authorizeProject(event, db, 'project.manage_api_keys', 'webhooks:manage');
  if (principal instanceof Response) return principal;
  if (principal.source !== 'session') {
    return problem(
      403,
      'Session required',
      'API keys can only be managed from a signed-in session',
    );
  }
  return { principal, db };
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorize(event);
  if (access instanceof Response) return access;
  const rows = await access.db
    .selectFrom('api_key')
    .select(['id', 'name', 'key_prefix', 'scopes', 'created_at', 'last_used_at', 'expires_at'])
    .where('project_id', '=', access.principal.projectId)
    .where('revoked_at', 'is', null)
    .orderBy('created_at', 'desc')
    .execute();
  return json(rows.map(endpointPayload));
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorize(event);
  if (access instanceof Response) return access;
  const parsed = await readJson(event.request, ApiKeyCreateSchema);
  if (parsed instanceof Response) return parsed;
  const invalidScope = parsed.scopes.find((scope) => !ALLOWED_SCOPES.has(scope));
  if (invalidScope) return problem(400, 'Invalid API key scope', `Unknown scope: ${invalidScope}`);

  const secret = createApiKeySecret();
  const expiresAt = parsed.expires_at ? new Date(parsed.expires_at) : null;
  const id = uuidv7();
  const row = await access.db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto('api_key')
      .values({
        id,
        project_id: access.principal.projectId,
        name: parsed.name,
        key_hash: hashApiKeySecret(secret),
        key_prefix: apiKeyPrefix(secret),
        scopes: parsed.scopes,
        last_used_at: null,
        expires_at: expiresAt,
        revoked_at: null,
      })
      .returning(['id', 'name', 'key_prefix', 'scopes', 'created_at', 'last_used_at', 'expires_at'])
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.principal.userId },
          {
            action: 'api_key.created',
            resourceType: 'api_key',
            resourceId: created.id,
            projectId: access.principal.projectId,
            metadata: { name: created.name, scopes: created.scopes },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.principal.projectId,
        event_type: 'project.updated',
        payload: {
          project_id: access.principal.projectId,
          api_key_id: created.id,
          change: 'created',
        },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'api-key-change',
          project_id: access.principal.projectId,
          api_key_id: created.id,
          action: 'created',
        }),
      )
      .execute();
    return created;
  });

  const response = ApiKeyCreatedSchema.parse({ ...endpointPayload(row), secret });
  return json(response, { status: 201, headers: { 'cache-control': 'no-store' } });
};
