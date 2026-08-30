import { createHash } from 'node:crypto';
import {
  CloudflareApiError,
  createCloudflareClient,
  domainStatusFromProvider,
  providerFailure,
  providerFields,
  type CloudflareCustomHostname,
  type CloudflareForSaaSClient,
} from '@oss-tips/domain/cloudflare';
import {
  canViewContent,
  uuidv7,
  type EntitlementSnapshot,
  type VisibilityRule,
} from '@oss-tips/domain';
import { emailNotificationJob, type Db, type Job, type JsonValue } from '@oss-tips/db';
import { renderPostPublishedEmail, type EmailSender } from '@oss-tips/email';
import type { ExportObjectMeta, StorageClient } from '@oss-tips/storage';
import { sendEmailNotificationJob } from './email-notifications.js';
import { deliverEmail, type EmailRecipient } from './email-delivery.js';
import { workerPublicUrl } from './runtime-config.js';
import {
  cleanupExpiredExports,
  cleanupOrphanedPromotedObjects,
  cleanupStaleQuarantineObjects,
  purgeDeletedMedia,
  runStorageInventory,
  type StorageMaintenanceStorage,
} from './storage-maintenance.js';
import {
  cleanupExpiredOtpRateLimits,
  cleanupExpiredVerifications,
  cleanupIdleApiRateLimits,
  cleanupRawAnalytics,
  scrubOldSecurityIpAddresses,
  type RetentionMaintenanceDependencies,
} from './retention-maintenance.js';

const EXPORT_TTL_MS = 24 * 60 * 60 * 1_000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

type ExportKind = 'supporters' | 'payments' | 'memberships';
type ExportFormat = 'csv' | 'json';

type JobPayload = Record<string, unknown>;

export type JobHandler = (job: Job) => Promise<void>;
type Recipient = EmailRecipient;

export class JobRetryError extends Error {
  constructor(
    message: string,
    readonly runAt: Date,
  ) {
    super(message);
    this.name = 'JobRetryError';
  }
}

export type JobHandlerDependencies = {
  db: Db;
  storage?: Pick<StorageClient, 'putExport'> & Partial<StorageMaintenanceStorage>;
  email?: EmailSender;
  cloudflare?: CloudflareForSaaSClient;
  authSecret?: string;
  publicAppUrl?: string;
  now?: () => Date;
};

export function postNotificationDedupeKey(postId: string, userId: string): string {
  return `post:${postId}:user:${userId}`;
}

type StoredVisibilityRule = {
  rule_kind: string;
  minimum_tier_rank: number | null;
  selected_tier_ids: unknown;
};

function postVisibilityRule(rules: readonly StoredVisibilityRule[]): VisibilityRule | null {
  const nonPublic = rules.filter((rule) => rule.rule_kind !== 'public');
  if (nonPublic.length === 0) return { kind: 'public' };
  if (nonPublic.length !== 1) return null;
  const rule = nonPublic[0];
  if (!rule) return null;
  if (rule.rule_kind === 'signed_in_supporter') return { kind: 'signed_in_supporter' };
  if (
    rule.rule_kind === 'minimum_tier_rank' &&
    rule.minimum_tier_rank !== null &&
    Number.isInteger(rule.minimum_tier_rank) &&
    rule.minimum_tier_rank >= 0
  ) {
    return { kind: 'minimum_tier_rank', rank: rule.minimum_tier_rank };
  }
  if (rule.rule_kind === 'selected_tier_ids') {
    let selected = rule.selected_tier_ids;
    if (typeof selected === 'string') {
      try {
        selected = JSON.parse(selected) as unknown;
      } catch {
        selected = null;
      }
    }
    const tierIds = Array.isArray(selected)
      ? selected.filter(
          (tierId): tierId is string => typeof tierId === 'string' && tierId.length > 0,
        )
      : [];
    return tierIds.length > 0 ? { kind: 'selected_tier_ids', tierIds } : null;
  }
  return null;
}

async function postSupporterRecipients(
  db: Db,
  projectId: string,
  rule: VisibilityRule,
  now: Date,
): Promise<Recipient[]> {
  const rows = await db
    .selectFrom('entitlement')
    .innerJoin('user', 'user.id', 'entitlement.user_id')
    .select([
      'entitlement.user_id as user_id',
      'entitlement.kind',
      'entitlement.tier_rank',
      'entitlement.tier_id',
      'entitlement.starts_at',
      'entitlement.ends_at',
      'entitlement.revoked_at',
      'user.email',
      'user.locale',
    ])
    .where('entitlement.project_id', '=', projectId)
    .where('entitlement.user_id', 'is not', null)
    .where('entitlement.kind', 'in', ['membership', 'one_off'])
    .where('user.email_verified', '=', true)
    .execute();
  const byUser = new Map<string, { recipient: Recipient; entitlements: EntitlementSnapshot[] }>();
  for (const row of rows) {
    if (row.kind !== 'membership' && row.kind !== 'one_off') continue;
    if (!row.user_id) continue;
    const current = byUser.get(row.user_id);
    const entitlement: EntitlementSnapshot = {
      kind: row.kind,
      tierRank: row.tier_rank,
      tierId: row.tier_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      revokedAt: row.revoked_at,
    };
    if (current) {
      current.entitlements.push(entitlement);
    } else {
      byUser.set(row.user_id, {
        recipient: { userId: row.user_id, email: row.email, locale: row.locale },
        entitlements: [entitlement],
      });
    }
  }
  return [...byUser.values()]
    .filter(({ entitlements }) =>
      canViewContent({ rule, signedIn: true, activeEntitlements: entitlements, now }),
    )
    .map(({ recipient }) => recipient);
}

function postRequest(job: Job): { projectId: string; postId: string } {
  const payload = payloadOf(job);
  return {
    projectId: requiredString(payload, 'project_id'),
    postId: requiredString(payload, 'post_id'),
  };
}

async function publishScheduledPost(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, postId } = postRequest(job);
  const now = dependencies.now?.() ?? new Date();
  await dependencies.db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('post')
      .selectAll()
      .where('id', '=', postId)
      .where('project_id', '=', projectId)
      .forUpdate()
      .executeTakeFirst();
    if (
      !current ||
      current.status !== 'scheduled' ||
      !current.scheduled_at ||
      current.scheduled_at > now
    )
      return;
    const post = await trx
      .updateTable('post')
      .set({ status: 'published', published_at: now, scheduled_at: null, updated_at: now })
      .where('id', '=', postId)
      .where('status', '=', 'scheduled')
      .returning(['id', 'project_id', 'slug', 'notify_supporters'])
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('audit_event')
      .values({
        id: uuidv7(),
        actor_id: null,
        actor_type: 'system',
        session_id: null,
        action: 'post.published',
        resource_type: 'post',
        resource_id: post.id,
        project_id: projectId,
        reason: null,
        ip_hash: null,
        before_hash: null,
        after_hash: null,
        correlation_id: uuidv7(),
        metadata_redacted: { slug: post.slug, scheduled: true },
      })
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: projectId,
        event_type: 'post.published',
        payload: { project_id: projectId, post_id: post.id, slug: post.slug },
        published_at: null,
      })
      .execute();
    if (post.notify_supporters) {
      await trx
        .insertInto('job')
        .values({
          id: uuidv7(),
          queue: 'default',
          kind: 'post.notify_supporters',
          payload: { project_id: projectId, post_id: post.id },
          status: 'pending',
          attempt_count: 0,
          max_attempts: 5,
          run_at: now,
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .execute();
    }
  });
}

async function notifyPostSupporters(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, postId } = postRequest(job);
  const now = dependencies.now?.() ?? new Date();
  const post = await dependencies.db
    .selectFrom('post')
    .select(['id', 'slug', 'title', 'notify_supporters', 'status'])
    .where('id', '=', postId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
  if (!post || post.status !== 'published' || !post.notify_supporters) return;
  const [project, visibilityRules] = await Promise.all([
    dependencies.db
      .selectFrom('project')
      .select(['name', 'slug'])
      .where('id', '=', projectId)
      .executeTakeFirstOrThrow(),
    dependencies.db
      .selectFrom('post_visibility_rule')
      .select(['rule_kind', 'minimum_tier_rank', 'selected_tier_ids'])
      .where('post_id', '=', postId)
      .execute(),
  ]);
  const rule = postVisibilityRule(visibilityRules);
  if (!rule) return;
  const supporters = await postSupporterRecipients(dependencies.db, projectId, rule, now);
  for (const supporter of supporters) {
    if (!supporter.userId) continue;
    await deliverEmail(dependencies, {
      recipient: supporter,
      dedupeKey: postNotificationDedupeKey(postId, supporter.userId),
      template: 'post-published',
      metadata: { project_id: projectId, post_id: postId, user_id: supporter.userId },
      jobId: job.id,
      render: (locale) =>
        renderPostPublishedEmail({
          projectName: project.name,
          title: post.title,
          postUrl: workerPublicUrl(
            dependencies.publicAppUrl,
            `/${project.slug}/posts/${post.slug}`,
          ),
          locale,
        }),
    });
  }
}

function payloadOf(job: Job): JobPayload {
  if (typeof job.payload !== 'object' || job.payload === null || Array.isArray(job.payload)) {
    throw new Error('Job payload must be an object');
  }
  return job.payload as JobPayload;
}

function requiredString(payload: JobPayload, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new Error(`Job payload ${key} is invalid`);
  }
  return value;
}

function exportRequest(job: Job): {
  projectId: string;
  kind: ExportKind;
  format: ExportFormat;
  payload: JobPayload;
} {
  const payload = payloadOf(job);
  const projectId = requiredString(payload, 'project_id');
  const kind = payload.kind;
  const format = payload.format ?? 'csv';
  if (kind !== 'supporters' && kind !== 'payments' && kind !== 'memberships') {
    throw new Error('Job payload kind is invalid');
  }
  if (format !== 'csv' && format !== 'json') throw new Error('Job payload format is invalid');
  if (!SAFE_ID.test(job.id)) throw new Error('Job id is invalid');
  return { projectId, kind, format, payload };
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  return JSON.stringify(value);
}

function csvValue(value: unknown): string {
  const text = textValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvBody(rows: Array<Record<string, unknown>>): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length === 0) return '\n';
  return (
    [
      columns.map(csvValue).join(','),
      ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
    ].join('\n') + '\n'
  );
}

function jsonBody(rows: Array<Record<string, unknown>>): string {
  return `${JSON.stringify(rows, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )}\n`;
}

async function exportRows(
  db: Db,
  projectId: string,
  kind: ExportKind,
): Promise<Array<Record<string, unknown>>> {
  const project = await db
    .selectFrom('project')
    .select('id')
    .where('id', '=', projectId)
    .executeTakeFirst();
  if (!project) throw new Error('Project for export was not found');

  if (kind === 'payments') {
    const rows = await db
      .selectFrom('payment')
      .leftJoin('user', 'user.id', 'payment.user_id')
      .select([
        'payment.id',
        'payment.created_at',
        'payment.status',
        'payment.cadence',
        'payment.currency',
        'payment.exponent',
        'payment.customer_charge_minor',
        'payment.project_amount_minor',
        'payment.platform_tip_minor',
        'payment.oss_project_fee_minor',
        'payment.stripe_application_fee_minor',
        'payment.stripe_payment_intent_id',
        'user.name as supporter_name',
      ])
      .where('payment.project_id', '=', projectId)
      .orderBy('payment.created_at', 'asc')
      .execute();
    return rows;
  }

  if (kind === 'supporters') {
    const rows = await db
      .selectFrom('payment')
      .leftJoin('user', 'user.id', 'payment.user_id')
      .select([
        'payment.id as support_id',
        'payment.created_at as supported_at',
        'payment.status',
        'payment.cadence',
        'payment.currency',
        'payment.project_amount_minor as amount_minor',
        'user.name as supporter_name',
      ])
      .where('payment.project_id', '=', projectId)
      .where('payment.status', '=', 'succeeded')
      .orderBy('payment.created_at', 'asc')
      .execute();
    return rows;
  }

  const rows = await db
    .selectFrom('subscription')
    .innerJoin('tier', 'tier.id', 'subscription.tier_id')
    .leftJoin('user', 'user.id', 'subscription.user_id')
    .select([
      'subscription.id',
      'subscription.created_at',
      'subscription.status',
      'subscription.cadence',
      'subscription.currency',
      'subscription.project_amount_minor',
      'subscription.current_period_end',
      'tier.name as tier_name',
      'user.name as supporter_name',
    ])
    .where('subscription.project_id', '=', projectId)
    .orderBy('subscription.created_at', 'asc')
    .execute();
  return rows;
}

function exportKey(projectId: string, jobId: string, format: ExportFormat): string {
  return `exports/${projectId}/${jobId}.${format}`;
}

async function writeProjectExport(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, kind, format, payload } = exportRequest(job);
  if (!dependencies.storage) throw new Error('Storage is unavailable for project exports');
  const rows = await exportRows(dependencies.db, projectId, kind);
  const body = new TextEncoder().encode(format === 'csv' ? csvBody(rows) : jsonBody(rows));
  const contentType: ExportObjectMeta['contentType'] =
    format === 'csv' ? 'text/csv' : 'application/json';
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_MS);
  const storageKey = exportKey(projectId, job.id, format);

  await dependencies.storage.putExport(storageKey, body, { contentType, expiresAt });

  const checksum = createHash('sha256').update(body).digest('hex');
  await dependencies.db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('object_asset')
      .select('id')
      .where('project_id', '=', projectId)
      .where('purpose', '=', 'export')
      .where('storage_key', '=', storageKey)
      .executeTakeFirst();
    const assetId = existing?.id ?? uuidv7();
    if (existing) {
      await trx
        .updateTable('object_asset')
        .set({
          content_type: contentType,
          byte_size: BigInt(body.length),
          checksum,
          visibility: 'private',
          soft_deleted_at: null,
          expires_at: expiresAt,
          updated_at: now,
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await trx
        .insertInto('object_asset')
        .values({
          id: assetId,
          project_id: projectId,
          purpose: 'export',
          visibility: 'private',
          storage_key: storageKey,
          content_type: contentType,
          byte_size: BigInt(body.length),
          checksum,
          expires_at: expiresAt,
          soft_deleted_at: null,
        })
        .execute();
    }
    await trx
      .updateTable('job')
      .set({
        payload: {
          ...payload,
          asset_id: assetId,
          storage_key: storageKey,
          expires_at: expiresAt.toISOString(),
        } as JsonValue,
        updated_at: now,
      })
      .where('id', '=', job.id)
      .execute();
  });
}

function domainRequest(job: Job): {
  projectId: string;
  domainId: string;
} {
  const payload = payloadOf(job);
  return {
    projectId: requiredString(payload, 'project_id'),
    domainId: requiredString(payload, 'domain_id'),
  };
}

function optionalString(payload: JobPayload, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new Error(`Job payload ${key} is invalid`);
  }
  return value;
}

function domainRemovalRequest(job: Job): {
  projectId: string;
  domainId: string;
  providerId?: string;
} {
  const payload = payloadOf(job);
  const providerId = optionalString(payload, 'provider_id');
  return {
    projectId: requiredString(payload, 'project_id'),
    domainId: requiredString(payload, 'domain_id'),
    ...(providerId ? { providerId } : {}),
  };
}

async function ensureCloudflareHostname(
  cloudflare: CloudflareForSaaSClient,
  hostname: string,
): Promise<CloudflareCustomHostname> {
  if (cloudflare.findByHostname) {
    const existing = await cloudflare.findByHostname(hostname);
    if (existing) return existing;
  }
  try {
    return await cloudflare.create(hostname);
  } catch (error) {
    if (cloudflare.findByHostname && error instanceof CloudflareApiError && error.status === 409) {
      const existing = await cloudflare.findByHostname(hostname);
      if (existing) return existing;
    }
    throw error;
  }
}

async function provisionDomain(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, domainId } = domainRequest(job);
  const now = dependencies.now?.() ?? new Date();
  const cloudflare = dependencies.cloudflare ?? createCloudflareClient();
  try {
    await dependencies.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('custom_domain')
        .selectAll()
        .where('id', '=', domainId)
        .forUpdate()
        .executeTakeFirst();
      if (!row) return;
      if (row.project_id !== projectId) {
        throw new Error('Domain job project does not match domain');
      }
      if (row.status !== 'requested') return;

      let remote: CloudflareCustomHostname;
      try {
        remote = row.provider_id
          ? await cloudflare.get(row.provider_id)
          : await ensureCloudflareHostname(cloudflare, row.hostname);
      } catch {
        throw new JobRetryError(
          'Cloudflare custom hostname request failed',
          new Date(now.getTime() + 5 * 60_000),
        );
      }
      const fields = providerFields(remote, now);
      const next = await trx
        .updateTable('custom_domain')
        .set({ ...fields, grace_until: null, updated_at: now })
        .where('id', '=', domainId)
        .where('project_id', '=', projectId)
        .where('status', '<>', 'removed')
        .returningAll()
        .executeTakeFirst();

      if (!next) {
        await trx
          .insertInto('job')
          .values({
            id: uuidv7(),
            queue: 'domains',
            kind: 'domain.delete',
            payload: { project_id: projectId, domain_id: domainId, provider_id: remote.id },
            status: 'pending',
            attempt_count: 0,
            max_attempts: 10,
            run_at: now,
            locked_at: null,
            locked_by: null,
            last_error: null,
          })
          .execute();
        return;
      }

      await trx
        .insertInto('audit_event')
        .values({
          id: uuidv7(),
          actor_id: null,
          actor_type: 'system',
          session_id: null,
          action: 'domain.provisioned',
          resource_type: 'custom_domain',
          resource_id: domainId,
          project_id: projectId,
          reason: null,
          ip_hash: null,
          before_hash: null,
          after_hash: null,
          correlation_id: job.id,
          metadata_redacted: { status: next.status },
        })
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: projectId,
          event_type: 'project.updated',
          payload: { project_id: projectId, domain_id: domainId, change: 'provisioned' },
          published_at: null,
        })
        .execute();
      if (fields.retry_at) {
        await trx
          .insertInto('job')
          .values({
            id: uuidv7(),
            queue: 'domains',
            kind: 'domain.challenge',
            payload: { project_id: projectId, domain_id: domainId, provider_id: remote.id },
            status: 'pending',
            attempt_count: 0,
            max_attempts: 10,
            run_at: fields.retry_at,
            locked_at: null,
            locked_by: null,
            last_error: null,
          })
          .execute();
      }
    });
  } catch (error) {
    if (error instanceof JobRetryError) throw error;
    throw new JobRetryError(
      'Persisting custom domain state failed',
      new Date(now.getTime() + 5 * 60_000),
    );
  }
}

async function removeDomain(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, domainId, providerId: requestedProviderId } = domainRemovalRequest(job);
  const row = await dependencies.db
    .selectFrom('custom_domain')
    .selectAll()
    .where('id', '=', domainId)
    .executeTakeFirst();
  if (row && row.project_id !== projectId) {
    throw new Error('Domain job project does not match domain');
  }
  if (row && row.status !== 'removed') return;

  const providerId = row?.provider_id ?? requestedProviderId;
  if (!providerId && !row?.retry_at) return;
  const now = dependencies.now?.() ?? new Date();
  if (providerId) {
    try {
      await (dependencies.cloudflare ?? createCloudflareClient()).remove(providerId);
    } catch (error) {
      if (!(error instanceof CloudflareApiError && error.status === 404)) {
        throw new JobRetryError(
          'Cloudflare custom hostname removal failed',
          new Date(now.getTime() + 5 * 60_000),
        );
      }
    }
  }

  if (!row || (!row.provider_id && !row.retry_at)) return;
  try {
    await dependencies.db.transaction().execute(async (trx) => {
      let update = trx
        .updateTable('custom_domain')
        .set({ provider_id: null, retry_at: null, last_error: null, updated_at: now })
        .where('id', '=', domainId)
        .where('project_id', '=', projectId)
        .where('status', '=', 'removed');
      update = providerId
        ? update.where('provider_id', '=', providerId)
        : update.where('provider_id', 'is', null);
      const next = await update.returningAll().executeTakeFirst();
      if (!next) return;
      await trx
        .insertInto('audit_event')
        .values({
          id: uuidv7(),
          actor_id: null,
          actor_type: 'system',
          session_id: null,
          action: 'domain.removal_completed',
          resource_type: 'custom_domain',
          resource_id: domainId,
          project_id: projectId,
          reason: null,
          ip_hash: null,
          before_hash: null,
          after_hash: null,
          correlation_id: job.id,
          metadata_redacted: { provider_id: providerId ?? null },
        })
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: projectId,
          event_type: 'project.updated',
          payload: { project_id: projectId, domain_id: domainId, change: 'removal_completed' },
          published_at: null,
        })
        .execute();
    });
  } catch {
    throw new JobRetryError(
      'Persisting custom domain removal failed',
      new Date(now.getTime() + 5 * 60_000),
    );
  }
}

async function reconcileDomain(dependencies: JobHandlerDependencies, job: Job): Promise<void> {
  const { projectId, domainId } = domainRequest(job);
  const row = await dependencies.db
    .selectFrom('custom_domain')
    .selectAll()
    .where('id', '=', domainId)
    .executeTakeFirst();
  if (!row || row.status === 'removed') return;
  if (row.project_id !== projectId) throw new Error('Domain job project does not match domain');
  if (!row.provider_id) throw new Error('Custom domain has no provider id');

  const now = dependencies.now?.() ?? new Date();
  let remote: CloudflareCustomHostname;
  try {
    const cloudflare = dependencies.cloudflare ?? createCloudflareClient();
    remote = await cloudflare.get(row.provider_id);
  } catch (error) {
    const failure = providerFailure(error);
    await dependencies.db.transaction().execute(async (trx) => {
      const retryAt = failure.status === 'failed' ? new Date(now.getTime() + 5 * 60_000) : null;
      const updated = await trx
        .updateTable('custom_domain')
        .set({
          ...(failure.status === 'removed' ? { provider_id: null } : {}),
          status: failure.status,
          canonical_enabled: false,
          last_error: failure.message,
          retry_at: retryAt,
          updated_at: now,
        })
        .where('id', '=', domainId)
        .where('project_id', '=', projectId)
        .where('status', '<>', 'removed')
        .returningAll()
        .executeTakeFirst();
      if (!updated) return;
      if (failure.status === 'removed') {
        await trx
          .insertInto('audit_event')
          .values({
            id: uuidv7(),
            actor_id: null,
            actor_type: 'system',
            session_id: null,
            action: 'domain.removal_completed',
            resource_type: 'custom_domain',
            resource_id: domainId,
            project_id: projectId,
            reason: null,
            ip_hash: null,
            before_hash: null,
            after_hash: null,
            correlation_id: job.id,
            metadata_redacted: { provider_id: row.provider_id },
          })
          .execute();
        await trx
          .insertInto('outbox_event')
          .values({
            id: uuidv7(),
            aggregate_type: 'project',
            aggregate_id: projectId,
            event_type: 'project.updated',
            payload: { project_id: projectId, domain_id: domainId, change: 'removal_completed' },
            published_at: null,
          })
          .execute();
      } else if (row.status !== 'failed') {
        const failureEventId = uuidv7();
        await trx
          .insertInto('audit_event')
          .values({
            id: failureEventId,
            actor_id: null,
            actor_type: 'system',
            session_id: null,
            action: 'domain.verification_failed',
            resource_type: 'custom_domain',
            resource_id: domainId,
            project_id: projectId,
            reason: null,
            ip_hash: null,
            before_hash: null,
            after_hash: null,
            correlation_id: job.id,
            metadata_redacted: { status: failure.status },
          })
          .execute();
        await trx
          .insertInto('job')
          .values(
            emailNotificationJob({
              notification: 'domain-failure',
              project_id: projectId,
              domain_id: domainId,
              event_id: failureEventId,
              failure: 'Custom domain verification needs attention.',
            }),
          )
          .execute();
      }
    });
    if (failure.status === 'failed') {
      throw new JobRetryError(failure.message, new Date(now.getTime() + 5 * 60_000));
    }
    return;
  }

  const fields = providerFields(remote, now);
  await dependencies.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('custom_domain')
      .set({ ...fields, grace_until: null, updated_at: now })
      .where('id', '=', domainId)
      .where('project_id', '=', projectId)
      .where('status', '<>', 'removed')
      .execute();
  });
  if (fields.retry_at)
    throw new JobRetryError('Domain validation is still pending', fields.retry_at);
}

export function createJobHandlers(
  dependencies: JobHandlerDependencies,
): Record<string, JobHandler> {
  const maintenanceDependencies = () => {
    if (!dependencies.storage?.deleteObject || !dependencies.storage.listObjects) {
      throw new Error('Storage maintenance is unavailable');
    }
    return {
      db: dependencies.db,
      storage: dependencies.storage as StorageMaintenanceStorage,
      ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
    };
  };
  const retentionDependencies = (): RetentionMaintenanceDependencies => ({
    db: dependencies.db,
    ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
  });
  return {
    'project.export': (job) => writeProjectExport(dependencies, job),
    'domain.provision': (job) => provisionDomain(dependencies, job),
    'domain.delete': (job) => removeDomain(dependencies, job),
    'domain.challenge': (job) => reconcileDomain(dependencies, job),
    'post.publish': (job) => publishScheduledPost(dependencies, job),
    'post.notify_supporters': (job) => notifyPostSupporters(dependencies, job),
    'email.notification': (job) => sendEmailNotificationJob(dependencies, job),
    'storage.inventory': async () => {
      const maintenance = maintenanceDependencies();
      await runStorageInventory(maintenance);
      await cleanupOrphanedPromotedObjects(maintenance);
      await cleanupStaleQuarantineObjects(maintenance);
    },
    'storage.cleanup_exports': () =>
      cleanupExpiredExports(maintenanceDependencies()).then(() => undefined),
    'storage.purge_media': () => purgeDeletedMedia(maintenanceDependencies()).then(() => undefined),
    'retention.verification': () =>
      cleanupExpiredVerifications(retentionDependencies()).then(() => undefined),
    'retention.otp_limits': () =>
      cleanupExpiredOtpRateLimits(retentionDependencies()).then(() => undefined),
    'retention.analytics': () => cleanupRawAnalytics(retentionDependencies()).then(() => undefined),
    'retention.security_ip': () =>
      scrubOldSecurityIpAddresses(retentionDependencies()).then(() => undefined),
    'retention.api_rate_limits': () =>
      cleanupIdleApiRateLimits(retentionDependencies()).then(() => undefined),
  };
}

export { domainStatusFromProvider };
