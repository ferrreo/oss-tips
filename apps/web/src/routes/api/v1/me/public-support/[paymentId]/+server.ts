import { PublicSupportPatchSchema } from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, problem, readJson, requireSession } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const body = await readJson(event.request, PublicSupportPatchSchema);
  if (body instanceof Response) return body;
  if (body.message?.trim() && body.show_message === false) {
    return problem(
      400,
      'Invalid public message preference',
      'A visible message is required to publish text',
    );
  }

  const db = getDb();
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'public_show_name',
      'public_show_amount',
      'public_show_message',
      'public_display_name',
      'public_message',
    ])
    .where('id', '=', event.params.paymentId)
    .where('user_id', '=', session.userId)
    .executeTakeFirst();
  if (!payment) return problem(404, 'Support record not found');
  if (
    payment.public_show_message !== true &&
    (body.show_message === true || Boolean(body.message?.trim()))
  ) {
    return problem(
      409,
      'Public message unavailable',
      'Public message preferences are not enabled for this support record',
    );
  }

  const existing = await db
    .selectFrom('supporter_public_profile')
    .select(['display_name', 'show_name', 'show_amount', 'show_message'])
    .where('project_id', '=', payment.project_id)
    .where('user_id', '=', session.userId)
    .executeTakeFirst();
  const showName = payment.public_show_name && (body.show_name ?? existing?.show_name ?? true);
  const showAmount =
    payment.public_show_amount && (body.show_amount ?? existing?.show_amount ?? true);
  const showMessage =
    payment.public_show_message && (body.show_message ?? existing?.show_message ?? true);
  const displayName =
    existing?.display_name ??
    payment.public_display_name ??
    event.locals.session?.user.name ??
    null;
  const message = body.message !== undefined ? body.message : payment.public_message;
  await db.transaction().execute(async (trx) => {
    if (body.message !== undefined) {
      await trx
        .updateTable('payment')
        .set({ public_message: message || null, updated_at: new Date() })
        .where('id', '=', payment.id)
        .execute();
    }
    if (existing) {
      await trx
        .updateTable('supporter_public_profile')
        .set({
          show_name: showName,
          show_amount: showAmount,
          show_message: showMessage,
          updated_at: new Date(),
        })
        .where('project_id', '=', payment.project_id)
        .where('user_id', '=', session.userId)
        .execute();
    } else {
      await trx
        .insertInto('supporter_public_profile')
        .values({
          id: uuidv7(),
          user_id: session.userId,
          project_id: payment.project_id,
          display_name: displayName,
          show_name: showName,
          show_amount: showAmount,
          show_message: showMessage,
        })
        .execute();
    }
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: session.userId },
          {
            action: 'supporter.public_support_updated',
            resourceType: 'payment',
            resourceId: payment.id,
            projectId: payment.project_id,
            metadata: {
              show_name: showName,
              show_amount: showAmount,
              show_message: showMessage,
              message_set: Boolean(message),
            },
          },
        ),
      )
      .execute();
  });
  return json(
    PublicSupportPatchSchema.parse({
      show_name: showName,
      show_amount: showAmount,
      show_message: showMessage,
      ...(showMessage && message ? { message } : { message: null }),
    }),
    { headers: { 'cache-control': 'private, no-store' } },
  );
};
