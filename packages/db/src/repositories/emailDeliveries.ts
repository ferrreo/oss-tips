import { uuidv7 } from '@oss-tips/domain';
import { sql, type Kysely } from 'kysely';
import type { Db } from '../client.js';
import type { Database } from '../types.js';

export const EMAIL_DELIVERY_STATUSES = [
  'pending',
  'sending',
  'sent',
  'delayed',
  'delivered',
  'bounced',
  'complained',
  'suppressed',
  'failed',
] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];
export type EmailSuppressionReason = 'bounce' | 'complaint' | 'provider';

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sending: 1,
  sent: 2,
  delayed: 3,
  delivered: 4,
  bounced: 5,
  complained: 5,
  suppressed: 5,
  failed: 5,
};

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function lockEmailSuppression(db: Kysely<Database>, email: string): Promise<unknown> {
  return sql`select pg_advisory_xact_lock(hashtextextended(${normalizeEmailAddress(email)}, 0))`.execute(
    db,
  );
}

export async function lockEmailSuppressionForTransaction(
  db: Kysely<Database>,
  email: string,
): Promise<void> {
  await lockEmailSuppression(db, email);
}

async function executeInTransaction<T>(
  db: Kysely<Database>,
  callback: (transaction: Kysely<Database>) => Promise<T>,
): Promise<T> {
  if (db.isTransaction || typeof db.transaction !== 'function') return callback(db);
  return db.transaction().execute(callback);
}

/**
 * Serialize delivery and permanent-suppression changes for one recipient.
 * The transaction intentionally stays pinned through the callback so the advisory lock remains
 * valid behind transaction-pooled PgBouncer. This bounds concurrent provider calls by pool size;
 * split claim/send only with an idempotent outbox protocol.
 */
export async function withEmailSuppressionLock<T>(
  db: Db,
  email: string,
  callback: (transaction: Db) => Promise<T>,
): Promise<T> {
  return executeInTransaction(db, async (transaction) => {
    await lockEmailSuppression(transaction, email);
    return callback(transaction);
  });
}

function shouldApplyStatus(current: string, next: EmailDeliveryStatus): boolean {
  if (current === next) return false;
  const currentRank = STATUS_RANK[current] ?? -1;
  const nextRank = STATUS_RANK[next] ?? -1;
  return nextRank > currentRank || (nextRank === currentRank && currentRank < 5);
}

function sentAtForStatus(status: EmailDeliveryStatus, occurredAt: Date): Date | null {
  return ['sent', 'delayed', 'delivered', 'bounced', 'complained', 'suppressed'].includes(status)
    ? occurredAt
    : null;
}

export function createEmailDeliveriesRepository(db: Db) {
  return {
    async isSuppressed(email: string): Promise<boolean> {
      const row = await db
        .selectFrom('email_suppression')
        .select('email_address')
        .where('email_address', '=', normalizeEmailAddress(email))
        .executeTakeFirst();
      return Boolean(row);
    },

    async recordProviderEvent(input: {
      providerEventId: string;
      providerEmailId: string | null;
      eventType: string;
      status: EmailDeliveryStatus;
      occurredAt: Date;
      suppression?: {
        reason: EmailSuppressionReason;
        emailAddresses: readonly string[];
      };
      now?: Date;
    }): Promise<{ created: boolean; deliveryId: string | null; statusApplied: boolean }> {
      const now = input.now ?? new Date();
      const suppressionEmails = input.suppression
        ? Array.from(
            new Set(
              input.suppression.emailAddresses
                .map(normalizeEmailAddress)
                .filter((email) => email.length > 0),
            ),
          ).sort()
        : [];
      return executeInTransaction(db, async (trx) => {
        for (const email of suppressionEmails) {
          await lockEmailSuppression(trx, email);
        }
        const delivery = input.providerEmailId
          ? await trx
              .selectFrom('email_delivery')
              .select(['id', 'status', 'sent_at'])
              .where('provider_id', '=', input.providerEmailId)
              .forUpdate()
              .executeTakeFirst()
          : undefined;

        const event = await trx
          .insertInto('email_delivery_event')
          .values({
            id: uuidv7(),
            provider_event_id: input.providerEventId,
            provider_email_id: input.providerEmailId,
            email_delivery_id: delivery?.id ?? null,
            event_type: input.eventType,
            status: input.status,
            occurred_at: input.occurredAt,
          })
          .onConflict((oc) => oc.column('provider_event_id').doNothing())
          .returning('id')
          .executeTakeFirst();

        let statusApplied = false;
        if (event && delivery && shouldApplyStatus(delivery.status, input.status)) {
          const sentAt = delivery.sent_at ?? sentAtForStatus(input.status, input.occurredAt);
          await trx
            .updateTable('email_delivery')
            .set({
              status: input.status,
              sent_at: sentAt,
              updated_at: now,
            })
            .where('id', '=', delivery.id)
            .executeTakeFirst();
          statusApplied = true;
        }

        if (event && input.suppression) {
          for (const email of suppressionEmails) {
            await trx
              .insertInto('email_suppression')
              .values({
                email_address: email,
                reason: input.suppression.reason,
                provider_event_id: input.providerEventId,
              })
              .onConflict((oc) => oc.column('email_address').doNothing())
              .executeTakeFirst();
          }
        }

        return {
          created: Boolean(event),
          deliveryId: delivery?.id ?? null,
          statusApplied,
        };
      });
    },

    /** Attach events received before the provider id was written and replay their status. */
    async reconcileProviderEvents(input: {
      deliveryId: string;
      providerEmailId: string;
      now?: Date;
    }): Promise<number> {
      const now = input.now ?? new Date();
      return executeInTransaction(db, async (trx) => {
        const delivery = await trx
          .selectFrom('email_delivery')
          .select(['id', 'status', 'sent_at'])
          .where('id', '=', input.deliveryId)
          .where('provider_id', '=', input.providerEmailId)
          .forUpdate()
          .executeTakeFirst();
        if (!delivery) return 0;

        await trx
          .updateTable('email_delivery_event')
          .set({ email_delivery_id: delivery.id })
          .where('provider_email_id', '=', input.providerEmailId)
          .where('email_delivery_id', 'is', null)
          .executeTakeFirst();

        const events = await trx
          .selectFrom('email_delivery_event')
          .select(['status', 'occurred_at'])
          .where('provider_email_id', '=', input.providerEmailId)
          .orderBy('occurred_at', 'asc')
          .execute();
        let currentStatus = delivery.status;
        let sentAt = delivery.sent_at;
        let applied = 0;
        for (const event of events) {
          if (!EMAIL_DELIVERY_STATUSES.includes(event.status as EmailDeliveryStatus)) continue;
          const status = event.status as EmailDeliveryStatus;
          if (!shouldApplyStatus(currentStatus, status)) continue;
          sentAt ??= sentAtForStatus(status, event.occurred_at);
          await trx
            .updateTable('email_delivery')
            .set({ status, sent_at: sentAt, updated_at: now })
            .where('id', '=', delivery.id)
            .executeTakeFirst();
          currentStatus = status;
          applied += 1;
        }
        return applied;
      });
    },
  };
}

export type EmailDeliveriesRepository = ReturnType<typeof createEmailDeliveriesRepository>;
