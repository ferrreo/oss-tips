import type { RequestHandler } from './$types';
import { uuidv7 } from '@oss-tips/domain';
import { auditRecord, authorizeProject, problem } from '../../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { softDeleteAssetIfUnreferenced } from '$lib/server/storage';

/** Detach an asset from a post revision; the asset remains reusable or removable by its owner. */
export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_posts', 'posts:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const row = await db
    .selectFrom('post_attachment')
    .innerJoin('post_revision', 'post_revision.id', 'post_attachment.post_revision_id')
    .innerJoin('post', 'post.id', 'post_revision.post_id')
    .select(['post_attachment.id', 'post.project_id', 'post_attachment.object_asset_id'])
    .where('post_attachment.id', '=', event.params.attachmentId)
    .where('post.id', '=', event.params.id)
    .where('post.project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!row) return problem(404, 'Attachment not found');
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('post_attachment').where('id', '=', row.id).execute();
    await softDeleteAssetIfUnreferenced(trx, row.object_asset_id);
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'post.attachment_removed',
            resourceType: 'post_attachment',
            resourceId: row.id,
            projectId: row.project_id,
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: row.project_id,
        event_type: 'project.updated',
        payload: {
          project_id: row.project_id,
          post_id: event.params.id,
          change: 'attachment_removed',
        },
        published_at: null,
      })
      .execute();
  });
  return new Response(null, { status: 204 });
};
