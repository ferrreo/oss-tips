import {
  ProjectSupportEmailVerificationRequestSchema,
  ProjectSupportEmailVerificationSchema,
} from '@oss-tips/api-contracts';
import {
  emailNotificationJob,
  normalizeEmailAddress,
  withEmailSuppressionLock,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import {
  createSupportEmailVerificationValue,
  supportEmailCodeMatches,
  supportEmailIdentifier,
} from '@oss-tips/email';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { getAuthSecret } from '$lib/server/auth';
import {
  SUPPORT_EMAIL_CODE_TTL_MS,
  SUPPORT_EMAIL_RESEND_COOLDOWN_MS,
} from '$lib/server/support-email-verification';

function response(status: 'pending' | 'verified', email: string, expiresAt: Date | null) {
  return ProjectSupportEmailVerificationSchema.parse({
    status,
    email,
    expires_at: expiresAt?.toISOString() ?? null,
  });
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.change_fee_mode', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectSupportEmailVerificationRequestSchema);
  if (body instanceof Response) return body;

  const project = await db
    .selectFrom('project')
    .select(['support_email', 'support_email_verified_at'])
    .where('id', '=', access.projectId)
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');

  const secret = getAuthSecret();
  if (body.action === 'send') {
    const email = (body.email ?? project.support_email)?.trim().toLowerCase();
    if (!email) return problem(400, 'Support email required');
    if (
      project.support_email &&
      normalizeEmailAddress(project.support_email) === email &&
      project.support_email_verified_at
    ) {
      return json(response('verified', email, null), {
        headers: { 'cache-control': 'private, no-store' },
      });
    }

    const identifier = supportEmailIdentifier(access.projectId, email, secret);
    const snapshotSupportEmail = project.support_email
      ? normalizeEmailAddress(project.support_email)
      : null;
    const supportEmailChanged = snapshotSupportEmail !== email;
    try {
      const sendResult = await withEmailSuppressionLock(
        db,
        project.support_email ?? email,
        async (trx) => {
          const lockedProject = await trx
            .selectFrom('project')
            .select(['support_email', 'status'])
            .where('id', '=', access.projectId)
            .forUpdate()
            .executeTakeFirst();
          const lockedSupportEmail = lockedProject?.support_email
            ? normalizeEmailAddress(lockedProject.support_email)
            : null;
          if (lockedSupportEmail !== snapshotSupportEmail) throw new SupportEmailStateError();
          const demotePublishedProject =
            supportEmailChanged && lockedProject?.status === 'published';
          const previous = await trx
            .selectFrom('verification')
            .select(['created_at'])
            .where('identifier', '=', identifier)
            .orderBy('created_at', 'desc')
            .executeTakeFirst();
          const retryAfter = previous
            ? Math.ceil(
                (previous.created_at.getTime() + SUPPORT_EMAIL_RESEND_COOLDOWN_MS - Date.now()) /
                  1000,
              )
            : 0;
          if (retryAfter > 0) return { kind: 'cooldown' as const, retryAfter };
          const expiresAt = new Date(Date.now() + SUPPORT_EMAIL_CODE_TTL_MS);
          const verificationId = uuidv7();
          const verification = createSupportEmailVerificationValue(identifier, secret);
          await trx
            .deleteFrom('verification')
            .where('identifier', 'like', `project-support-email:${access.projectId}:%`)
            .execute();
          await trx
            .insertInto('verification')
            .values({
              id: verificationId,
              identifier,
              value: verification.value,
              expires_at: expiresAt,
            })
            .execute();
          await trx
            .insertInto('job')
            .values(
              emailNotificationJob({
                notification: 'support-email-verification',
                project_id: access.projectId,
                verification_id: verificationId,
              }),
            )
            .execute();
          await trx
            .updateTable('project')
            .set({
              support_email: email,
              support_email_verified_at: null,
              ...(demotePublishedProject ? { status: 'draft' } : {}),
              updated_at: new Date(),
            })
            .where('id', '=', access.projectId)
            .execute();
          if (demotePublishedProject) {
            await trx
              .insertInto('project_status_history')
              .values({
                id: uuidv7(),
                project_id: access.projectId,
                from_status: 'published',
                to_status: 'draft',
                reason: 'support_email_changed',
                changed_by: access.userId,
              })
              .execute();
          }
          await trx
            .insertInto('audit_event')
            .values(
              auditRecord(
                event,
                { type: 'user', userId: access.userId },
                {
                  action: 'project.support_email.verification_requested',
                  resourceType: 'project',
                  resourceId: access.projectId,
                  projectId: access.projectId,
                  metadata: {
                    email_domain: email.split('@')[1] ?? '',
                    ...(demotePublishedProject ? { status: 'draft' } : {}),
                  },
                },
              ),
            )
            .execute();
          await trx
            .insertInto('outbox_event')
            .values({
              id: uuidv7(),
              aggregate_type: 'project',
              aggregate_id: access.projectId,
              event_type: 'project.updated',
              payload: {
                project_id: access.projectId,
                change: 'support_email_verification_requested',
                ...(demotePublishedProject ? { status: 'draft' } : {}),
              },
              published_at: null,
            })
            .execute();
          return { kind: 'sent' as const, expiresAt };
        },
      );
      if (sendResult.kind === 'cooldown') {
        return problem(
          429,
          'Verification email already sent',
          'Please wait before requesting another code',
          {
            headers: { 'retry-after': String(sendResult.retryAfter) },
          },
        );
      }
      return json(response('pending', email, sendResult.expiresAt), {
        status: 202,
        headers: { 'cache-control': 'private, no-store' },
      });
    } catch (error) {
      if (error instanceof SupportEmailStateError) {
        return problem(409, 'Support email changed', 'Request a new verification code');
      }
      throw error;
    }
  }

  const email = project.support_email?.trim().toLowerCase();
  if (!email) return problem(400, 'Support email required');
  if (project.support_email_verified_at) return json(response('verified', email, null));
  const identifier = supportEmailIdentifier(access.projectId, email, secret);
  const stored = await db
    .selectFrom('verification')
    .select(['id', 'value', 'expires_at'])
    .where('identifier', '=', identifier)
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  if (!stored || stored.expires_at <= new Date()) {
    return problem(
      400,
      'Verification code expired',
      'Request a new support email verification code',
    );
  }
  if (!supportEmailCodeMatches(identifier, body.code, stored.value, secret)) {
    return problem(400, 'Invalid verification code');
  }

  try {
    await withEmailSuppressionLock(db, email, async (trx) => {
      const deleted = await trx
        .deleteFrom('verification')
        .where('id', '=', stored.id)
        .where('value', '=', stored.value)
        .execute();
      if (deleted[0]?.numDeletedRows === 0n) throw new SupportEmailStateError();
      const updated = await trx
        .updateTable('project')
        .set({ support_email_verified_at: new Date(), updated_at: new Date() })
        .where('id', '=', access.projectId)
        .where('support_email', '=', email)
        .execute();
      if (updated[0]?.numUpdatedRows === 0n) throw new SupportEmailStateError();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'project.support_email.verified',
              resourceType: 'project',
              resourceId: access.projectId,
              projectId: access.projectId,
              metadata: { email_domain: email.split('@')[1] ?? '' },
            },
          ),
        )
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: access.projectId,
          event_type: 'project.updated',
          payload: { project_id: access.projectId, change: 'support_email_verified' },
          published_at: null,
        })
        .execute();
    });
  } catch (error) {
    if (error instanceof SupportEmailStateError) {
      return problem(409, 'Support email changed', 'Request a new verification code');
    }
    throw error;
  }
  return json(response('verified', email, null), {
    headers: { 'cache-control': 'private, no-store' },
  });
};

class SupportEmailStateError extends Error {}
