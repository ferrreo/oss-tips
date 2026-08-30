import { createHash } from 'node:crypto';
import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type { MessageBlock, SupporterMessageThread } from '../types.js';

export const MESSAGE_RATE_LIMITS = {
  thread: { limit: 10, windowMs: 10 * 60 * 1000 },
  user: { limit: 30, windowMs: 10 * 60 * 1000 },
  project: { limit: 500, windowMs: 10 * 60 * 1000 },
} as const;

export type MessageActor = { kind: 'user'; userId: string } | { kind: 'guest'; emailHash: string };

export type MessageRateLimitResult = {
  allowed: boolean;
  scope?: keyof typeof MESSAGE_RATE_LIMITS;
  retryAfterSeconds: number;
};

export type MessageBlockResult = {
  blocked: boolean;
  block?: MessageBlock;
};

export function messageActorKey(actor: MessageActor): string {
  return hashKey(actor.kind === 'user' ? `user:${actor.userId}` : `guest:${actor.emailHash}`);
}

export function guestMessageKey(emailHash: string): string {
  return hashKey(`guest:${emailHash}`);
}

export function projectMessageKey(projectId: string): string {
  return hashKey(`project:${projectId}`);
}

export function threadRecipientKey(threadId: string): string {
  return hashKey(`thread-recipient:${threadId}`);
}

function hashKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function uniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/**
 * Consume all three durable message buckets inside the caller's transaction.
 * The transaction argument can be a Kysely transaction or the root database.
 */
export async function consumeMessageRateLimit(
  db: Db,
  input: { threadId: string; projectId: string; actor: MessageActor; now?: Date },
): Promise<MessageRateLimitResult> {
  const now = input.now ?? new Date();
  const entries = [
    {
      scope: 'thread' as const,
      keyHash: hashKey(`thread:${input.threadId}`),
      policy: MESSAGE_RATE_LIMITS.thread,
    },
    {
      scope: 'user' as const,
      keyHash: messageActorKey(input.actor),
      policy: MESSAGE_RATE_LIMITS.user,
    },
    {
      scope: 'project' as const,
      keyHash: projectMessageKey(input.projectId),
      policy: MESSAGE_RATE_LIMITS.project,
    },
  ];

  let rows = await db
    .selectFrom('message_rate_limit')
    .selectAll()
    .where(
      'scope',
      'in',
      entries.map((entry) => entry.scope),
    )
    .where(
      'key_hash',
      'in',
      entries.map((entry) => entry.keyHash),
    )
    .forUpdate()
    .execute();

  for (const entry of entries) {
    if (rows.some((row) => row.scope === entry.scope && row.key_hash === entry.keyHash)) continue;
    await db
      .insertInto('message_rate_limit')
      .values({
        id: uuidv7(),
        scope: entry.scope,
        key_hash: entry.keyHash,
        window_started_at: now,
        message_count: 0,
      })
      .onConflict((oc) => oc.columns(['scope', 'key_hash']).doNothing())
      .execute();
  }

  rows = await db
    .selectFrom('message_rate_limit')
    .selectAll()
    .where(
      'scope',
      'in',
      entries.map((entry) => entry.scope),
    )
    .where(
      'key_hash',
      'in',
      entries.map((entry) => entry.keyHash),
    )
    .forUpdate()
    .execute();

  const decisions = entries.map((entry) => {
    const row = rows.find(
      (candidate) => candidate.scope === entry.scope && candidate.key_hash === entry.keyHash,
    );
    if (!row) throw new Error('Message rate limit row could not be created');
    const windowEndsAt = row.window_started_at.getTime() + entry.policy.windowMs;
    return {
      entry,
      row,
      windowActive: windowEndsAt > now.getTime(),
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000)),
    };
  });
  const blocked = decisions.find(
    (decision) =>
      decision.windowActive && decision.row.message_count >= decision.entry.policy.limit,
  );
  if (blocked) {
    return {
      allowed: false,
      scope: blocked.entry.scope,
      retryAfterSeconds: blocked.retryAfterSeconds,
    };
  }

  for (const decision of decisions) {
    const reset = !decision.windowActive;
    await db
      .updateTable('message_rate_limit')
      .set({
        window_started_at: reset ? now : decision.row.window_started_at,
        message_count: reset ? 1 : decision.row.message_count + 1,
        updated_at: now,
      })
      .where('id', '=', decision.row.id)
      .execute();
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function isMessageBlocked(
  db: Db,
  input: { projectId: string; threadId: string; actorKey: string; targetKey: string },
): Promise<boolean> {
  const row = await db
    .selectFrom('message_block')
    .select('id')
    .where('project_id', '=', input.projectId)
    .where('thread_id', '=', input.threadId)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('blocker_key_hash', '=', input.actorKey),
          eb('blocked_key_hash', '=', input.targetKey),
        ]),
        eb.and([
          eb('blocker_key_hash', '=', input.targetKey),
          eb('blocked_key_hash', '=', input.actorKey),
        ]),
      ]),
    )
    .executeTakeFirst();
  return Boolean(row);
}

export async function blockMessageThread(
  db: Db,
  input: {
    projectId: string;
    threadId: string;
    blockerKey: string;
    blockedKey: string;
  },
): Promise<MessageBlockResult> {
  if (input.blockerKey === input.blockedKey) return { blocked: false };
  const block = await db
    .insertInto('message_block')
    .values({
      id: uuidv7(),
      project_id: input.projectId,
      thread_id: input.threadId,
      blocker_key_hash: input.blockerKey,
      blocked_key_hash: input.blockedKey,
    })
    .onConflict((oc) =>
      oc.columns(['project_id', 'thread_id', 'blocker_key_hash', 'blocked_key_hash']).doNothing(),
    )
    .returningAll()
    .executeTakeFirst();
  return { blocked: true, ...(block ? { block } : {}) };
}

export async function reportMessageThread(
  db: Db,
  input: {
    projectId: string;
    threadId: string;
    reporterUserId?: string | null;
    reporterKey: string;
    reason: string;
    now?: Date;
  },
): Promise<{ created: boolean; reportId?: string }> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 500 || /(?:https?|ftp|javascript|data):|www\./i.test(reason)) {
    throw new Error('Report reason is invalid');
  }
  const report = await db
    .insertInto('abuse_report')
    .values({
      id: uuidv7(),
      reporter_user_id: input.reporterUserId ?? null,
      reporter_key_hash: input.reporterKey,
      project_id: input.projectId,
      resource_type: 'supporter_message_thread',
      resource_id: input.threadId,
      reason,
      status: 'open',
      created_at: input.now ?? new Date(),
      updated_at: input.now ?? new Date(),
    })
    .onConflict((oc) =>
      oc
        .columns(['resource_type', 'resource_id', 'reporter_key_hash'])
        .where((eb) =>
          eb.and([eb('reporter_key_hash', 'is not', null), eb('resource_id', 'is not', null)]),
        )
        .doNothing(),
    )
    .returning('id')
    .executeTakeFirst();
  return { created: Boolean(report), ...(report ? { reportId: report.id } : {}) };
}

export async function ensurePaymentThread(
  db: Db,
  paymentId: string,
): Promise<SupporterMessageThread | undefined> {
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'user_id',
      'status',
      'cadence',
      'public_show_message',
      'public_display_name',
      'public_message',
    ])
    .where('id', '=', paymentId)
    .executeTakeFirst();
  if (!payment || payment.status !== 'succeeded') return undefined;
  if (!['one_off', 'monthly', 'annual'].includes(payment.cadence)) return undefined;

  const addInitialMessage = async (threadId: string): Promise<void> => {
    const body = payment.public_show_message ? payment.public_message?.trim() : '';
    if (!body) return;
    const existingMessage = await db
      .selectFrom('supporter_message')
      .select('id')
      .where('thread_id', '=', threadId)
      .where('body', '=', body)
      .executeTakeFirst();
    if (existingMessage) return;
    await db
      .insertInto('supporter_message')
      .values({
        id: uuidv7(),
        thread_id: threadId,
        author_user_id: payment.user_id,
        author_name: payment.public_display_name,
        body,
        is_internal: false,
      })
      .execute();
  };

  const existing = await db
    .selectFrom('supporter_message_thread')
    .selectAll()
    .where('payment_id', '=', payment.id)
    .executeTakeFirst();
  if (existing) {
    await addInitialMessage(existing.id);
    return existing;
  }

  try {
    const created = await db
      .insertInto('supporter_message_thread')
      .values({
        id: uuidv7(),
        project_id: payment.project_id,
        supporter_user_id: payment.user_id,
        payment_id: payment.id,
        status: 'open',
      })
      .returningAll()
      .executeTakeFirst();
    if (created) {
      await addInitialMessage(created.id);
      return created;
    }
  } catch (error) {
    if (!uniqueViolation(error)) throw error;
  }
  const thread = await db
    .selectFrom('supporter_message_thread')
    .selectAll()
    .where('payment_id', '=', payment.id)
    .executeTakeFirst();
  if (thread) await addInitialMessage(thread.id);
  return thread;
}
