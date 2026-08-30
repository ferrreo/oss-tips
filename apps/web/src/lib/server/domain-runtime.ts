import type { Db } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import {
  CloudflareApiError,
  createCloudflareClient,
  type CloudflareCustomHostname,
  type CloudflareForSaaSClient,
} from './cloudflare';
import { domainStatusFromProvider, graceExpiry, isFivePercentMode } from './custom-domains';

let cachedClient: CloudflareForSaaSClient | null = null;

export function getCloudflareClient(): CloudflareForSaaSClient {
  if (!cachedClient) cachedClient = createCloudflareClient();
  return cachedClient;
}

export function validationFields(result: CloudflareCustomHostname): {
  validationName: string | null;
  validationValue: string | null;
  cnameTarget: string | null;
} {
  const txtRecord = result.validationRecords.find((item) => item.txtName && item.txtRecord);
  const cnameRecord = result.validationRecords.find((item) => item.cnameTarget || item.cname);
  return {
    validationName: txtRecord?.txtName ?? null,
    validationValue: txtRecord?.txtRecord ?? null,
    cnameTarget: cnameRecord?.cnameTarget ?? null,
  };
}

export function providerFields(result: CloudflareCustomHostname, now = new Date()) {
  const status = domainStatusFromProvider(result.status, result.sslStatus);
  const validation = validationFields(result);
  return {
    provider_id: status === 'removed' ? null : result.id,
    status,
    ssl_status: result.sslStatus,
    validation_name: validation.validationName,
    validation_value: validation.validationValue,
    cname_target: validation.cnameTarget,
    canonical_enabled: status === 'active',
    last_error: status === 'failed' ? 'Cloudflare certificate or DNS validation failed' : null,
    retry_at:
      status === 'active' || status === 'removed' ? null : new Date(now.getTime() + 5 * 60_000),
  };
}

export function storedDomainStatus(
  status: string,
):
  'requested' | 'awaiting_dns' | 'validating' | 'active' | 'failed' | 'grace_disabled' | 'removed' {
  return [
    'requested',
    'awaiting_dns',
    'validating',
    'active',
    'failed',
    'grace_disabled',
    'removed',
  ].includes(status)
    ? (status as ReturnType<typeof storedDomainStatus>)
    : 'requested';
}

export function domainResponse(row: {
  id: string;
  project_id: string;
  hostname: string;
  status: string;
  ssl_status: string | null;
  provider_id: string | null;
  validation_method: string;
  validation_name: string | null;
  validation_value: string | null;
  cname_target: string | null;
  grace_until: Date | null;
  last_error: string | null;
  retry_at: Date | null;
  canonical_enabled: boolean;
  created_at: Date;
}) {
  const status = storedDomainStatus(row.status);
  return {
    id: row.id,
    project_id: row.project_id,
    hostname: row.hostname,
    status,
    ssl_status: row.ssl_status,
    provider_id: row.provider_id,
    validation: {
      method: row.validation_method,
      name: row.validation_name,
      value: row.validation_value,
    },
    cname_target: row.cname_target,
    grace_until: row.grace_until?.toISOString() ?? null,
    last_error: row.last_error,
    retry_at: row.retry_at?.toISOString() ?? null,
    canonical_enabled: row.canonical_enabled,
    created_at: row.created_at.toISOString(),
  };
}

export async function markModeGrace(
  db: Db,
  row: {
    id: string;
    project_id: string;
    status: string;
    provider_id: string | null;
    grace_until: Date | null;
    canonical_enabled: boolean;
  },
  mode: string | null | undefined,
  now = new Date(),
) {
  if (isFivePercentMode(mode) || row.status === 'removed') return null;
  if (row.status === 'grace_disabled' && row.grace_until && row.grace_until > now) return null;
  const graceUntil = row.grace_until ?? graceExpiry(now);
  if (graceUntil <= now) {
    return db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('custom_domain')
        .set({ status: 'removed', canonical_enabled: false, retry_at: now, updated_at: now })
        .where('id', '=', row.id)
        .returningAll()
        .executeTakeFirst();
      if (updated) {
        await trx
          .insertInto('job')
          .values({
            id: uuidv7(),
            queue: 'domains',
            kind: 'domain.delete',
            payload: {
              project_id: row.project_id,
              domain_id: row.id,
              ...(updated.provider_id ? { provider_id: updated.provider_id } : {}),
            },
            status: 'pending',
            attempt_count: 0,
            max_attempts: 10,
            run_at: now,
            locked_at: null,
            locked_by: null,
            last_error: null,
          })
          .execute();
      }
      return updated;
    });
  }
  return db
    .updateTable('custom_domain')
    .set({
      status: 'grace_disabled',
      grace_until: graceUntil,
      retry_at: graceUntil,
      updated_at: now,
    })
    .where('id', '=', row.id)
    .returningAll()
    .executeTakeFirst();
}

export function providerFailure(error: unknown): { status: 'removed' | 'failed'; message: string } {
  if (error instanceof CloudflareApiError && error.status === 404) {
    return { status: 'removed', message: 'Cloudflare no longer has this hostname' };
  }
  return { status: 'failed', message: 'Cloudflare custom hostname request failed' };
}
