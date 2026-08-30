import { ThreadMessageCreateSchema, ThreadMessageSchema } from '@oss-tips/api-contracts';
import {
  consumeMessageRateLimit,
  emailNotificationJob,
  guestMessageKey,
  hashGuestEmail,
  isMessageBlocked,
  messageActorKey,
  threadRecipientKey,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.reply_supporters', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ThreadMessageCreateSchema);
  if (body instanceof Response) return body;
  if (/(?:https?|ftp|javascript|data):|www\./i.test(body.body)) {
    return problem(400, 'Links are not supported in messages');
  }
  const thread = await db
    .selectFrom('supporter_message_thread as thread')
    .innerJoin('payment', 'payment.id', 'thread.payment_id')
    .select([
      'thread.id',
      'thread.project_id',
      'thread.supporter_user_id',
      'payment.status',
      'payment.receipt_email',
    ])
    .where('thread.id', '=', event.params.id)
    .where('thread.project_id', '=', access.projectId)
    .where('payment.status', '=', 'succeeded')
    .executeTakeFirst();
  if (!thread) return problem(404, 'Thread not found');
  const actorKey = messageActorKey({ kind: 'user', userId: access.userId });
  const targetKey = thread.supporter_user_id
    ? messageActorKey({ kind: 'user', userId: thread.supporter_user_id })
    : thread.receipt_email
      ? guestMessageKey(hashGuestEmail(thread.receipt_email))
      : threadRecipientKey(thread.id);
  const result = await db.transaction().execute(async (trx) => {
    if (
      await isMessageBlocked(trx, {
        projectId: thread.project_id,
        threadId: thread.id,
        actorKey,
        targetKey,
      })
    ) {
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'project.message_blocked_attempt',
              resourceType: 'supporter_message_thread',
              resourceId: thread.id,
              projectId: thread.project_id,
            },
          ),
        )
        .execute();
      return { kind: 'blocked' as const };
    }
    const rate = await consumeMessageRateLimit(trx, {
      threadId: thread.id,
      projectId: thread.project_id,
      actor: { kind: 'user', userId: access.userId },
    });
    if (!rate.allowed) {
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'project.message_rate_limited',
              resourceType: 'supporter_message_thread',
              resourceId: thread.id,
              projectId: thread.project_id,
              metadata: {
                scope: rate.scope ?? 'unknown',
                retry_after_seconds: rate.retryAfterSeconds,
              },
            },
          ),
        )
        .execute();
      return { kind: 'rate_limited' as const, retryAfterSeconds: rate.retryAfterSeconds };
    }
    const created = await trx
      .insertInto('supporter_message')
      .values({
        id: uuidv7(),
        thread_id: thread.id,
        author_user_id: access.userId,
        author_name: event.locals.session?.user.name ?? null,
        body: body.body,
      })
      .returning(['id', 'body', 'created_at'])
      .executeTakeFirstOrThrow();
    const now = new Date();
    await trx
      .updateTable('supporter_message_thread')
      .set({ updated_at: now })
      .where('id', '=', thread.id)
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: thread.project_id,
        event_type: 'supporter.message_received',
        payload: { project_id: thread.project_id, thread_id: thread.id, message_id: created.id },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'supporter.message_sent',
            resourceType: 'supporter_message',
            resourceId: created.id,
            projectId: thread.project_id,
          },
        ),
      )
      .execute();
    if (!thread.supporter_user_id && thread.receipt_email) {
      await trx
        .insertInto('job')
        .values(
          emailNotificationJob({
            notification: 'guest-reply',
            project_id: thread.project_id,
            thread_id: thread.id,
            message_id: created.id,
          }),
        )
        .execute();
    }
    return { kind: 'sent' as const, created };
  });
  if (result.kind === 'blocked') return problem(403, 'Conversation blocked');
  if (result.kind === 'rate_limited') {
    return problem(
      429,
      'Message rate limit reached',
      'Please wait before sending another message',
      {
        headers: { 'retry-after': String(result.retryAfterSeconds) },
      },
    );
  }
  const message = result.created;
  return json(
    ThreadMessageSchema.parse({
      id: message.id,
      body: message.body,
      from_supporter: false,
      created_at: message.created_at.toISOString(),
    }),
    { status: 201, headers: { 'cache-control': 'private, no-store' } },
  );
};
