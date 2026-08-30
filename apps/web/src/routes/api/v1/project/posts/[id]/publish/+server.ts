import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { readPostPublishInput } from '$lib/server/post-input';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readPostPublishInput(event.request);
  if (body instanceof Response) return body;
  const now = new Date();
  const row = await db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('post')
      .select(['id', 'project_id', 'slug', 'notify_supporters'])
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!current) return undefined;
    const scheduled =
      body.scheduledAt !== undefined && body.scheduledAt !== null && body.scheduledAt > now;
    const notifySupporters = body.notifySupporters ?? current.notify_supporters;
    const post = await trx
      .updateTable('post')
      .set({
        status: scheduled ? 'scheduled' : 'published',
        published_at: scheduled ? null : now,
        scheduled_at: body.scheduledAt ?? null,
        notify_supporters: notifySupporters,
        updated_at: now,
      })
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .returning(['id', 'project_id', 'slug', 'status', 'published_at', 'scheduled_at'])
      .executeTakeFirst();
    if (!post) return undefined;
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: scheduled ? 'post.scheduled' : 'post.published',
            resourceType: 'post',
            resourceId: post.id,
            projectId: post.project_id,
            metadata: { slug: post.slug, scheduled_at: body.scheduledAt?.toISOString() ?? null },
          },
        ),
      )
      .execute();
    if (scheduled) {
      await trx
        .insertInto('job')
        .values({
          id: uuidv7(),
          queue: 'default',
          kind: 'post.publish',
          payload: { project_id: post.project_id, post_id: post.id },
          status: 'pending',
          attempt_count: 0,
          max_attempts: 5,
          run_at: body.scheduledAt as Date,
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .execute();
      return post;
    }
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: post.project_id,
        event_type: 'post.published',
        payload: { project_id: post.project_id, post_id: post.id, slug: post.slug },
        published_at: null,
      })
      .execute();
    if (notifySupporters) {
      await trx
        .insertInto('job')
        .values({
          id: uuidv7(),
          queue: 'default',
          kind: 'post.notify_supporters',
          payload: { project_id: post.project_id, post_id: post.id },
          status: 'pending',
          attempt_count: 0,
          max_attempts: 5,
          run_at: now,
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .execute();
    }
    return post;
  });
  if (!row) return problem(404, 'Post not found');
  return json(
    {
      published: row.status === 'published',
      scheduled: row.status === 'scheduled',
      id: row.id,
      published_at: row.published_at?.toISOString() ?? null,
      scheduled_at: row.scheduled_at?.toISOString() ?? null,
    },
    { status: 202 },
  );
};
