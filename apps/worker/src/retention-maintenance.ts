import {
  API_RATE_LIMIT_RETENTION_SECONDS,
  createApiRateLimitsRepository,
  type Db,
} from '@oss-tips/db';

/** Operational retention windows from docs/03 §16. */
export const OTP_RATE_LIMIT_RETENTION_SECONDS = 24 * 60 * 60;
export const ANALYTICS_RETENTION_SECONDS = 90 * 24 * 60 * 60;
export const SECURITY_IP_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export type RetentionMaintenanceDependencies = {
  db: Db;
  now?: () => Date;
};

function currentTime(dependencies: RetentionMaintenanceDependencies): Date {
  return dependencies.now?.() ?? new Date();
}

function cutoff(now: Date, retentionSeconds: number): Date {
  return new Date(now.getTime() - retentionSeconds * 1_000);
}

function deletedRows(result: { numDeletedRows: bigint } | undefined): number {
  return Number(result?.numDeletedRows ?? 0n);
}

function updatedRows(result: { numUpdatedRows: bigint } | undefined): number {
  return Number(result?.numUpdatedRows ?? 0n);
}

/** Verification values are single-use and have no value after their expiry. */
export async function cleanupExpiredVerifications(
  dependencies: RetentionMaintenanceDependencies,
): Promise<number> {
  const result = await dependencies.db
    .deleteFrom('verification')
    .where('expires_at', '<=', currentTime(dependencies))
    .executeTakeFirst();
  return deletedRows(result);
}

/** OTP rate-limit keys are transient counters, not account or financial records. */
export async function cleanupExpiredOtpRateLimits(
  dependencies: RetentionMaintenanceDependencies,
): Promise<number> {
  const now = currentTime(dependencies);
  const result = await dependencies.db
    .deleteFrom('otp_send_rate_limit')
    .where('updated_at', '<', cutoff(now, OTP_RATE_LIMIT_RETENTION_SECONDS))
    .executeTakeFirst();
  return deletedRows(result);
}

/** Keep only the documented 90-day raw analytics window; daily rollups are untouched. */
export async function cleanupRawAnalytics(
  dependencies: RetentionMaintenanceDependencies,
): Promise<number> {
  const now = currentTime(dependencies);
  const expiry = cutoff(now, ANALYTICS_RETENTION_SECONDS);
  const [hourly, dedupe] = await Promise.all([
    dependencies.db
      .deleteFrom('metric_event_hourly')
      .where('created_at', '<', expiry)
      .executeTakeFirst(),
    dependencies.db
      .deleteFrom('metric_event_dedupe')
      .where('created_at', '<', expiry)
      .executeTakeFirst(),
  ]);
  return deletedRows(hourly) + deletedRows(dedupe);
}

/** Remove old raw IPs while retaining security-event and session records. */
export async function scrubOldSecurityIpAddresses(
  dependencies: RetentionMaintenanceDependencies,
): Promise<number> {
  const now = currentTime(dependencies);
  const expiry = cutoff(now, SECURITY_IP_RETENTION_SECONDS);
  const [events, sessions] = await Promise.all([
    dependencies.db
      .updateTable('user_security_event')
      .set({ ip_address: null })
      .where('ip_address', 'is not', null)
      .where('created_at', '<', expiry)
      .executeTakeFirst(),
    dependencies.db
      .updateTable('session')
      .set({ ip_address: null })
      .where('ip_address', 'is not', null)
      .where('updated_at', '<', expiry)
      .executeTakeFirst(),
  ]);
  return updatedRows(events) + updatedRows(sessions);
}

/** API buckets already define their own 24-hour idle retention policy. */
export async function cleanupIdleApiRateLimits(
  dependencies: RetentionMaintenanceDependencies,
): Promise<number> {
  return createApiRateLimitsRepository(dependencies.db).cleanup({
    now: currentTime(dependencies),
    retentionSeconds: API_RATE_LIMIT_RETENTION_SECONDS,
  });
}
