import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { readPostCreateInput, type PostVisibilityInput } from '$lib/server/post-input';
import { postPayload } from '$lib/server/post-runtime';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:read');
  if (access instanceof Response) return access;
  const rows = await db
    .selectFrom('post')
    .select(['id', 'slug', 'title', 'published_at', 'status', 'scheduled_at', 'notify_supporters'])
    .where('project_id', '=', access.projectId)
    .orderBy('created_at', 'desc')
    .limit(100)
    .execute();
  return json(await Promise.all(rows.map((row) => postPayload(db, row))), {
    headers: { 'cache-control': 'private, no-store' },
  });
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readPostCreateInput(event.request);
  if (body instanceof Response) return body;
  const postId = uuidv7();
  const revisionId = uuidv7();
  const now = new Date();
  const scheduled = body.scheduledAt && body.scheduledAt > now;
  let row;
  try {
    row = await db.transaction().execute(async (trx) => {
      const post = await trx
        .insertInto('post')
        .values({
          id: postId,
          project_id: access.projectId,
          author_id: access.userId,
          title: body.title,
          slug: body.slug,
          status: scheduled ? 'scheduled' : 'draft',
          published_at: null,
          scheduled_at: scheduled ? body.scheduledAt : null,
          notify_supporters: body.notifySupporters,
        })
        .returning([
          'id',
          'slug',
          'title',
          'published_at',
          'status',
          'scheduled_at',
          'notify_supporters',
          'updated_at',
        ])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('post_revision')
        .values({
          id: revisionId,
          post_id: post.id,
          revision_number: 1,
          body_markdown: body.body,
          editor_json: null,
          created_by: access.userId,
        })
        .execute();
      await trx
        .insertInto('post_visibility_rule')
        .values(ruleValues(post.id, body.visibility))
        .execute();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'post.created',
              resourceType: 'post',
              resourceId: post.id,
              projectId: access.projectId,
              metadata: { slug: post.slug },
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
          payload: { project_id: access.projectId, post_id: post.id, change: 'created' },
          published_at: null,
        })
        .execute();
      if (scheduled) {
        await trx
          .insertInto('job')
          .values({
            id: uuidv7(),
            queue: 'default',
            kind: 'post.publish',
            payload: { project_id: access.projectId, post_id: post.id },
            status: 'pending',
            attempt_count: 0,
            max_attempts: 5,
            run_at: body.scheduledAt as Date,
            locked_at: null,
            locked_by: null,
            last_error: null,
          })
          .execute();
      }
      return post;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return problem(409, 'Post slug already exists');
    throw error;
  }
  return json(await postPayload(db, row), {
    status: 201,
    headers: { 'cache-control': 'private, no-store', etag: `"${row.updated_at.toISOString()}"` },
  });
};

function ruleValues(postId: string, visibility: PostVisibilityInput) {
  return {
    id: uuidv7(),
    post_id: postId,
    rule_kind: visibility.kind,
    minimum_tier_rank: visibility.minimumTierRank,
    selected_tier_ids: visibility.selectedTierIds,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
