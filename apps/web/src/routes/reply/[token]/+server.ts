import { problem, json } from '$lib/server/http';
import {
  blockMessageThread,
  createGuestAccessRepository,
  messageActorKey,
  projectMessageKey,
  reportMessageThread,
  statusOfGuestAccessToken,
} from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { appendGuestReply } from '$lib/server/guest-access';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { auditRecord, readJsonValue } from '../../api/api-utils';

type ReplyRequest = {
  action: 'reply' | 'block' | 'report';
  body?: string;
  reason?: string;
};

function readReplyBody(value: unknown): ReplyRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const action = input.action ?? 'reply';
  if (action !== 'reply' && action !== 'block' && action !== 'report') return null;
  if (action === 'reply' && typeof input.body !== 'string') return null;
  if (action === 'report' && typeof input.reason !== 'string') return null;
  return {
    action,
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(typeof input.reason === 'string' ? { reason: input.reason } : {}),
  };
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Reply unavailable', 'Database is required');
  const value = await readJsonValue(event.request);
  if (value instanceof Response) return value;
  const body = readReplyBody(value);
  if (body === null) return problem(400, 'Invalid reply request');

  const db = getDb();
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(event.params.token);
  const state = statusOfGuestAccessToken(token);
  if (!token || token.kind !== 'reply') return problem(404, 'Reply link unavailable');
  if (state === 'expired') return problem(410, 'Reply link expired');
  if (state === 'used') return problem(409, 'Reply link already used');
  if (state !== 'valid') return problem(404, 'Reply link unavailable');

  if (body.action !== 'reply') {
    const result = await db.transaction().execute(async (trx) => {
      const lockedToken = await trx
        .selectFrom('guest_access_token')
        .selectAll()
        .where('id', '=', token.id)
        .forUpdate()
        .executeTakeFirst();
      if (!lockedToken || lockedToken.kind !== 'reply' || !lockedToken.thread_id) {
        return { kind: 'invalid' as const };
      }
      const lockedState = statusOfGuestAccessToken(lockedToken);
      if (lockedState === 'expired') return { kind: 'expired' as const };
      if (lockedState === 'used') return { kind: 'used' as const };
      if (lockedState !== 'valid') return { kind: 'invalid' as const };
      const thread = await trx
        .selectFrom('supporter_message_thread as thread')
        .innerJoin('payment', 'payment.id', 'thread.payment_id')
        .select(['thread.id', 'thread.project_id', 'payment.status'])
        .where('thread.id', '=', lockedToken.thread_id)
        .where('payment.status', '=', 'succeeded')
        .forUpdate()
        .executeTakeFirst();
      if (!thread) return { kind: 'invalid' as const };

      const actorKey = messageActorKey({ kind: 'guest', emailHash: lockedToken.email_hash });
      const targetKey = projectMessageKey(thread.project_id);
      if (body.action === 'block') {
        await blockMessageThread(trx, {
          projectId: thread.project_id,
          threadId: thread.id,
          blockerKey: actorKey,
          blockedKey: targetKey,
        });
        await trx
          .insertInto('audit_event')
          .values(
            auditRecord(
              event,
              { type: 'guest' },
              {
                action: 'guest.thread_blocked',
                resourceType: 'supporter_message_thread',
                resourceId: thread.id,
                projectId: thread.project_id,
              },
            ),
          )
          .execute();
        return { kind: 'blocked' as const };
      }

      try {
        const report = await reportMessageThread(trx, {
          projectId: thread.project_id,
          threadId: thread.id,
          reporterUserId: null,
          reporterKey: actorKey,
          reason: body.reason ?? '',
        });
        await trx
          .insertInto('audit_event')
          .values(
            auditRecord(
              event,
              { type: 'guest' },
              {
                action: 'guest.thread_reported',
                resourceType: 'supporter_message_thread',
                resourceId: thread.id,
                projectId: thread.project_id,
                metadata: { report_created: report.created },
              },
            ),
          )
          .execute();
      } catch (error) {
        if (error instanceof Error && error.message === 'Report reason is invalid') {
          return { kind: 'invalid_report' as const };
        }
        throw error;
      }
      return { kind: 'reported' as const };
    });
    if (result.kind === 'expired') return problem(410, 'Reply link expired');
    if (result.kind === 'used') return problem(409, 'Reply link already used');
    if (result.kind === 'blocked') return json({ ok: true, action: 'block' });
    if (result.kind === 'reported') return json({ ok: true, action: 'report' });
    if (result.kind === 'invalid_report') {
      return problem(
        400,
        'Invalid report reason',
        'Keep your report under 500 characters and omit links',
      );
    }
    return problem(404, 'Reply link unavailable');
  }

  const result = await appendGuestReply(db, event.params.token, body.body ?? '');
  if (result.kind === 'sent')
    return json({ ok: true, message_id: result.messageId }, { status: 201 });
  if (result.kind === 'expired') return problem(410, 'Reply link expired');
  if (result.kind === 'used') return problem(409, 'Reply link already used');
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
  return problem(
    400,
    'Reply could not be sent',
    'Keep your message under 2,000 characters and omit links',
  );
};
