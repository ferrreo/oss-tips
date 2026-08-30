import { ProjectPostSchema, type ProjectPost } from '@oss-tips/api-contracts';
import type { Db, Post } from '@oss-tips/db';
import { toProjectPost } from '../../routes/api/public-api';

type PostPayloadRow = Pick<
  Post,
  'id' | 'slug' | 'title' | 'published_at' | 'status' | 'scheduled_at' | 'notify_supporters'
>;

export async function postPayload(db: Db, row: PostPayloadRow): Promise<ProjectPost> {
  const [revision, rules] = await Promise.all([
    db
      .selectFrom('post_revision')
      .select(['body_markdown'])
      .where('post_id', '=', row.id)
      .orderBy('revision_number', 'desc')
      .executeTakeFirst(),
    db
      .selectFrom('post_visibility_rule')
      .select(['rule_kind', 'minimum_tier_rank', 'selected_tier_ids'])
      .where('post_id', '=', row.id)
      .execute(),
  ]);
  const rule = rules.find((item) => item.rule_kind !== 'public') ?? rules[0];
  return ProjectPostSchema.parse(
    toProjectPost(
      row,
      revision?.body_markdown ?? null,
      rule?.minimum_tier_rank ?? null,
      rules.some((item) => item.rule_kind !== 'public'),
    ),
  );
}
