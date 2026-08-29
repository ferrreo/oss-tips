import type { Db } from '../client.js';
import type { NewPost, Post } from '../types.js';

export function createPostsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Post | undefined> {
      return db
        .selectFrom('post')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findBySlug(projectId: string, slug: string): Promise<Post | undefined> {
      return db
        .selectFrom('post')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('slug', '=', slug)
        .executeTakeFirst();
    },

    async listPublishedByProject(projectId: string, limit = 20): Promise<Post[]> {
      return db
        .selectFrom('post')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('status', '=', 'published')
        .orderBy('published_at', 'desc')
        .limit(limit)
        .execute();
    },

    async create(post: NewPost): Promise<Post> {
      return db
        .insertInto('post')
        .values(post)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async getLatestRevision(postId: string) {
      return db
        .selectFrom('post_revision')
        .selectAll()
        .where('post_id', '=', postId)
        .orderBy('revision_number', 'desc')
        .limit(1)
        .executeTakeFirst();
    },
  };
}

export type PostsRepository = ReturnType<typeof createPostsRepository>;
