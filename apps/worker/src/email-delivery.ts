import { createHash } from 'node:crypto';
import { uuidv7 } from '@oss-tips/domain';
import { resolveEmailLocale, type EmailSender, type RenderedEmail } from '@oss-tips/email';
import {
  createEmailDeliveriesRepository,
  normalizeEmailAddress,
  type Db,
  type EmailDeliveriesRepository,
  type JsonValue,
  withEmailSuppressionLock,
} from '@oss-tips/db';

export type EmailRecipient = {
  userId?: string;
  email: string;
  locale?: string | null;
};

export type EmailDeliveryDependencies = {
  db: Db;
  email?: EmailSender;
  emailDeliveries?: Pick<EmailDeliveriesRepository, 'reconcileProviderEvents'>;
  now?: () => Date;
};

const EMAIL_DELIVERY_LEASE_MS = 15 * 60_000;
const EMAIL_DELIVERY_TERMINAL_STATUSES = [
  'sent',
  'delivered',
  'bounced',
  'complained',
  'blocked',
  'suppressed',
] as readonly string[];

function objectMetadata(value: JsonValue): Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function metadataString(metadata: JsonValue, key: string): string | undefined {
  const value = objectMetadata(metadata)[key];
  return typeof value === 'string' ? value : undefined;
}

type EmailClaim = {
  id: string;
  reconcileOnly: boolean;
  providerId?: string;
};

export async function deliverEmail(
  dependencies: EmailDeliveryDependencies,
  input: {
    recipient: EmailRecipient;
    dedupeKey: string;
    template: string;
    metadata: JsonValue;
    jobId?: string;
    /** Retry a consumed deterministic guest link only to recover its delivery state. */
    retryUsedToken?: boolean;
    /** Recheck notification-specific state while recipient suppression lock is held. */
    validate?: (db: Db) => Promise<boolean>;
    render: (locale: string) => RenderedEmail | null | Promise<RenderedEmail | null>;
  },
): Promise<void> {
  let deliveryError: 'provider' | 'reconciliation' | null = null;
  await withEmailSuppressionLock(dependencies.db, input.recipient.email, async (db) => {
    if (input.validate && !(await input.validate(db))) return;
    const now = dependencies.now?.() ?? new Date();
    const claimToken = uuidv7();
    const deliveryMetadata: JsonValue = {
      ...objectMetadata(input.metadata),
      ...(input.jobId ? { job_id: input.jobId } : {}),
      delivery_claim_token: claimToken,
    };
    const normalizedRecipient = normalizeEmailAddress(input.recipient.email);
    const idempotencyKey = `oss-tips-email-${createHash('sha256').update(input.dedupeKey).digest('hex')}`;
    const claimed = await (async (trx: Db): Promise<EmailClaim | null> => {
      if (input.retryUsedToken) {
        const existing = await trx
          .selectFrom('email_delivery')
          .select(['id', 'status', 'provider_id'])
          .where('dedupe_key', '=', input.dedupeKey)
          .forUpdate()
          .executeTakeFirst();
        if (existing?.status === 'sent' && existing.provider_id) {
          return { id: existing.id, providerId: existing.provider_id, reconcileOnly: true };
        }
        if (!existing || !['sending', 'sent'].includes(existing.status)) return null;
      }
      // The transaction-scoped lock remains held through provider send; webhooks take the same lock.
      const suppression = await trx
        .selectFrom('email_suppression')
        .select('email_address')
        .where('email_address', '=', normalizedRecipient)
        .executeTakeFirst();
      if (suppression) {
        const inserted = await trx
          .insertInto('email_delivery')
          .values({
            id: uuidv7(),
            to_address: input.recipient.email,
            template: input.template,
            status: 'suppressed',
            provider_id: null,
            metadata: deliveryMetadata,
            dedupe_key: input.dedupeKey,
            sent_at: null,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc.column('dedupe_key').where('dedupe_key', 'is not', null).doNothing(),
          )
          .returning('id')
          .executeTakeFirst();
        if (inserted) return null;
        const existing = await trx
          .selectFrom('email_delivery')
          .select(['id', 'status'])
          .where('dedupe_key', '=', input.dedupeKey)
          .forUpdate()
          .executeTakeFirst();
        if (!existing || EMAIL_DELIVERY_TERMINAL_STATUSES.includes(existing.status)) return null;
        await trx
          .updateTable('email_delivery')
          .set({ status: 'suppressed', metadata: deliveryMetadata, updated_at: now })
          .where('id', '=', existing.id)
          .execute();
        return null;
      }
      const inserted = await trx
        .insertInto('email_delivery')
        .values({
          id: uuidv7(),
          to_address: input.recipient.email,
          template: input.template,
          status: 'sending',
          provider_id: null,
          metadata: deliveryMetadata,
          dedupe_key: input.dedupeKey,
          sent_at: null,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('dedupe_key').where('dedupe_key', 'is not', null).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (inserted) return { id: inserted.id, reconcileOnly: false };

      const existing = await trx
        .selectFrom('email_delivery')
        .select(['id', 'status', 'metadata', 'provider_id', 'updated_at'])
        .where('dedupe_key', '=', input.dedupeKey)
        .forUpdate()
        .executeTakeFirst();
      if (!existing || EMAIL_DELIVERY_TERMINAL_STATUSES.includes(existing.status)) {
        if (existing?.status === 'sent' && existing.provider_id) {
          return { id: existing.id, providerId: existing.provider_id, reconcileOnly: true };
        }
        if (input.retryUsedToken && existing?.status === 'sent' && !existing.provider_id) {
          const existingJobId = metadataString(existing.metadata, 'job_id');
          const updatedAt = existing.updated_at instanceof Date ? existing.updated_at : undefined;
          const leaseExpired =
            updatedAt !== undefined &&
            updatedAt.getTime() <= now.getTime() - EMAIL_DELIVERY_LEASE_MS;
          if (!input.jobId || (existingJobId !== input.jobId && !leaseExpired)) return null;
          const retry = await trx
            .updateTable('email_delivery')
            .set({ status: 'sending', metadata: deliveryMetadata, updated_at: now })
            .where('id', '=', existing.id)
            .where('status', '=', 'sent')
            .where('provider_id', 'is', null)
            .returning('id')
            .executeTakeFirst();
          return retry ? { id: retry.id, reconcileOnly: false } : null;
        }
        return null;
      }
      if (existing.status === 'sending') {
        const existingJobId = metadataString(existing.metadata, 'job_id');
        const updatedAt = existing.updated_at instanceof Date ? existing.updated_at : undefined;
        const leaseExpired =
          updatedAt !== undefined && updatedAt.getTime() <= now.getTime() - EMAIL_DELIVERY_LEASE_MS;
        if (!input.jobId || (existingJobId !== input.jobId && !leaseExpired)) return null;
        const retry = await trx
          .updateTable('email_delivery')
          .set({ status: 'sending', metadata: deliveryMetadata, updated_at: now })
          .where('id', '=', existing.id)
          .where('status', '=', 'sending')
          .returning('id')
          .executeTakeFirst();
        return retry ? { id: retry.id, reconcileOnly: false } : null;
      }
      const retry = await trx
        .updateTable('email_delivery')
        .set({ status: 'sending', metadata: deliveryMetadata, updated_at: now })
        .where('id', '=', existing.id)
        .where('status', 'in', ['pending', 'failed'])
        .returning('id')
        .executeTakeFirst();
      return retry ? { id: retry.id, reconcileOnly: false } : null;
    })(db);

    if (!claimed) return;
    if (claimed.reconcileOnly) {
      try {
        await (
          dependencies.emailDeliveries ?? createEmailDeliveriesRepository(db)
        ).reconcileProviderEvents({
          deliveryId: claimed.id,
          providerEmailId: claimed.providerId!,
          now,
        });
      } catch {
        deliveryError = 'reconciliation';
      }
      return;
    }
    if (!dependencies.email) {
      await db
        .updateTable('email_delivery')
        .set({ status: 'blocked', updated_at: now })
        .where('id', '=', claimed.id)
        .where('status', '=', 'sending')
        .where('metadata', '@>', { delivery_claim_token: claimToken })
        .execute();
      return;
    }

    const rendered = await input.render(resolveEmailLocale(input.recipient.locale));
    if (!rendered) {
      await db
        .updateTable('email_delivery')
        .set({ status: 'blocked', updated_at: now })
        .where('id', '=', claimed.id)
        .where('status', '=', 'sending')
        .where('metadata', '@>', { delivery_claim_token: claimToken })
        .execute();
      return;
    }

    let result: { id: string };
    try {
      result = await dependencies.email.send({
        to: input.recipient.email,
        idempotencyKey,
        ...rendered,
      });
    } catch {
      const failedAt = dependencies.now?.() ?? new Date();
      try {
        await db
          .updateTable('email_delivery')
          .set({ status: 'failed', updated_at: failedAt })
          .where('id', '=', claimed.id)
          .where('status', '=', 'sending')
          .where('metadata', '@>', { delivery_claim_token: claimToken })
          .execute();
      } catch {
        // Preserve provider failure semantics when delivery-state persistence also fails.
      }
      deliveryError = 'provider';
      return;
    }

    const completedAt = dependencies.now?.() ?? new Date();
    let completed;
    try {
      completed = await db
        .updateTable('email_delivery')
        .set({
          status: 'sent',
          provider_id: result.id,
          sent_at: completedAt,
          updated_at: completedAt,
        })
        .where('id', '=', claimed.id)
        .where('status', '=', 'sending')
        .where('metadata', '@>', { delivery_claim_token: claimToken })
        .returning('id')
        .executeTakeFirst();
    } catch {
      throw new Error('Email delivery state update failed');
    }
    if (completed?.id) {
      try {
        await (
          dependencies.emailDeliveries ?? createEmailDeliveriesRepository(db)
        ).reconcileProviderEvents({
          deliveryId: completed.id,
          providerEmailId: result.id,
          now: completedAt,
        });
      } catch {
        deliveryError = 'reconciliation';
      }
    }
  });
  if (deliveryError === 'provider') throw new Error('Email delivery failed');
  if (deliveryError === 'reconciliation') throw new Error('Email delivery reconciliation failed');
}
