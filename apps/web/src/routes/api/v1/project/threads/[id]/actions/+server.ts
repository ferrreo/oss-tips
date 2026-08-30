import {
  blockMessageThread,
  guestMessageKey,
  hashGuestEmail,
  messageActorKey,
  projectMessageKey,
  reportMessageThread,
  threadRecipientKey,
} from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJsonValue } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

type ThreadAction = { action: 'block' | 'report'; reason?: string };

async function readAction(request: Request): Promise<ThreadAction | Response> {
  const value = await readJsonValue(request);
  if (value instanceof Response) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return problem(400, 'Invalid thread action');
  }
  const input = value as Record<string, unknown>;
  if (input.action !== 'block' && input.action !== 'report') {
    return problem(400, 'Invalid thread action', 'action must be block or report');
  }
  if (input.action === 'report' && typeof input.reason !== 'string') {
    return problem(400, 'Report reason is required');
  }
  return {
    action: input.action,
    ...(typeof input.reason === 'string' ? { reason: input.reason } : {}),
  };
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorizeProject(event, getDb(), 'project.reply_supporters', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const action = await readAction(event.request);
  if (action instanceof Response) return action;

  const db = getDb();
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
  try {
    await db.transaction().execute(async (trx) => {
      if (action.action === 'block') {
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
              { type: 'user', userId: access.userId },
              {
                action: 'project.thread_blocked',
                resourceType: 'supporter_message_thread',
                resourceId: thread.id,
                projectId: thread.project_id,
              },
            ),
          )
          .execute();
        return;
      }

      const report = await reportMessageThread(trx, {
        projectId: thread.project_id,
        threadId: thread.id,
        reporterUserId: access.userId,
        reporterKey: actorKey,
        reason: action.reason ?? '',
      });
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'project.thread_reported',
              resourceType: 'supporter_message_thread',
              resourceId: thread.id,
              projectId: thread.project_id,
              metadata: { report_created: report.created },
            },
          ),
        )
        .execute();
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Report reason is invalid') {
      return problem(
        400,
        'Invalid report reason',
        'Keep your report under 500 characters and omit links',
      );
    }
    throw error;
  }

  return json(
    { ok: true, action: action.action },
    { headers: { 'cache-control': 'private, no-store' } },
  );
};
