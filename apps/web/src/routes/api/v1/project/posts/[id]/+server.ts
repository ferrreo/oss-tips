import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { readPostPatchInput, type PostVisibilityInput } from '$lib/server/post-input';
import { postPayload } from '$lib/server/post-runtime';
import { softDeleteAssetIfUnreferenced } from '$lib/server/storage';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:read');
  if (access instanceof Response) return access;
  const row = await db
    .selectFrom('post')
    .select([
      'id',
      'slug',
      'title',
      'published_at',
      'status',
      'scheduled_at',
      'notify_supporters',
      'updated_at',
    ])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!row) return problem(404, 'Post not found');
  return json(await postPayload(db, row), {
    headers: { 'cache-control': 'private, no-store', etag: postEtag(row.updated_at) },
  });
};

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readPostPatchInput(event.request);
  if (body instanceof Response) return body;
  const requestedEtag = event.request.headers.get('if-match');
  let conflictEtag: string | undefined;
  let row;
  try {
    row = await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('post')
        .select([
          'id',
          'slug',
          'title',
          'published_at',
          'status',
          'scheduled_at',
          'notify_supporters',
          'updated_at',
        ])
        .where('id', '=', event.params.id)
        .where('project_id', '=', access.projectId)
        .forUpdate()
        .executeTakeFirst();
      if (!current) return undefined;
      const currentEtag = postEtag(current.updated_at);
      if (requestedEtag && requestedEtag !== currentEtag) {
        conflictEtag = currentEtag;
        return undefined;
      }
      const scheduled =
        body.scheduledAt !== undefined &&
        body.scheduledAt !== null &&
        body.scheduledAt > new Date();
      const post = await trx
        .updateTable('post')
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.scheduledAt !== undefined ? { scheduled_at: body.scheduledAt } : {}),
          ...(body.notifySupporters !== undefined
            ? { notify_supporters: body.notifySupporters }
            : {}),
          ...(body.scheduledAt !== undefined && current.status !== 'published'
            ? { status: scheduled ? 'scheduled' : 'draft' }
            : {}),
          updated_at: new Date(),
        })
        .where('id', '=', current.id)
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
      if (body.body !== undefined) {
        const revision = await trx
          .selectFrom('post_revision')
          .select(['id', 'revision_number'])
          .where('post_id', '=', current.id)
          .orderBy('revision_number', 'desc')
          .limit(1)
          .executeTakeFirst();
        const revisionId = uuidv7();
        await trx
          .insertInto('post_revision')
          .values({
            id: revisionId,
            post_id: current.id,
            revision_number: Number(revision?.revision_number ?? 0) + 1,
            body_markdown: body.body ?? '',
            editor_json: null,
            created_by: access.userId,
          })
          .execute();
        if (revision) {
          const attachments = await trx
            .selectFrom('post_attachment')
            .select(['object_asset_id', 'sort_order'])
            .where('post_revision_id', '=', revision.id)
            .execute();
          if (attachments.length > 0) {
            await trx
              .insertInto('post_attachment')
              .values(
                attachments.map((attachment) => ({
                  id: uuidv7(),
                  post_revision_id: revisionId,
                  object_asset_id: attachment.object_asset_id,
                  sort_order: attachment.sort_order,
                })),
              )
              .execute();
          }
        }
      }
      if (body.visibility) {
        await trx.deleteFrom('post_visibility_rule').where('post_id', '=', current.id).execute();
        await trx
          .insertInto('post_visibility_rule')
          .values(ruleValues(current.id, body.visibility))
          .execute();
      }
      if (scheduled && current.status !== 'published') {
        await trx
          .insertInto('job')
          .values({
            id: uuidv7(),
            queue: 'default',
            kind: 'post.publish',
            payload: { project_id: access.projectId, post_id: current.id },
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
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'post.updated',
              resourceType: 'post',
              resourceId: current.id,
              projectId: access.projectId,
              metadata: { fields: Object.keys(body) },
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
          payload: { project_id: access.projectId, post_id: current.id, change: 'updated' },
          published_at: null,
        })
        .execute();
      return post;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return problem(409, 'Post slug already exists');
    throw error;
  }
  if (conflictEtag) {
    return problem(
      409,
      'Post changed',
      'This post changed elsewhere. Review your local draft before saving again.',
      {
        headers: { etag: conflictEtag },
      },
    );
  }
  if (!row) return problem(404, 'Post not found');
  return json(await postPayload(db, row), {
    headers: { 'cache-control': 'private, no-store', etag: postEtag(row.updated_at) },
  });
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const deleted = await db.transaction().execute(async (trx) => {
    const post = await trx
      .selectFrom('post')
      .select(['id', 'slug'])
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!post) return undefined;
    const attachmentRows = await trx
      .selectFrom('post_attachment')
      .innerJoin('post_revision', 'post_revision.id', 'post_attachment.post_revision_id')
      .select('post_attachment.object_asset_id')
      .where('post_revision.post_id', '=', post.id)
      .execute();
    const assetIds = [...new Set(attachmentRows.map(({ object_asset_id }) => object_asset_id))];
    await trx
      .deleteFrom('post')
      .where('id', '=', post.id)
      .where('project_id', '=', access.projectId)
      .executeTakeFirstOrThrow();
    for (const assetId of assetIds) await softDeleteAssetIfUnreferenced(trx, assetId);
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'post.deleted',
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
        payload: { project_id: access.projectId, post_id: post.id, change: 'deleted' },
        published_at: null,
      })
      .execute();
    return post;
  });
  if (!deleted) return problem(404, 'Post not found');
  return new Response(null, { status: 204 });
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

function postEtag(updatedAt: Date): string {
  return `"${updatedAt.toISOString()}"`;
}
