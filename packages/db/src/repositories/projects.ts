import type { Db } from '../client.js';
import type { NewProject, Project, ProjectUpdate } from '../types.js';

export function createProjectsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Project | undefined> {
      return db
        .selectFrom('project')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findBySlug(slug: string): Promise<Project | undefined> {
      return db
        .selectFrom('project')
        .selectAll()
        .where('slug', '=', slug)
        .executeTakeFirst();
    },

    async listByOrganisation(organisationId: string): Promise<Project[]> {
      return db
        .selectFrom('project')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .orderBy('created_at', 'desc')
        .execute();
    },

    async listPublished(limit = 50, cursor?: string): Promise<Project[]> {
      let query = db
        .selectFrom('project')
        .selectAll()
        .where('status', '=', 'published')
        .orderBy('updated_at', 'desc')
        .limit(limit);

      if (cursor) {
        query = query.where('updated_at', '<', new Date(cursor));
      }

      return query.execute();
    },

    async create(project: NewProject): Promise<Project> {
      return db
        .insertInto('project')
        .values(project)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async update(id: string, patch: ProjectUpdate): Promise<Project | undefined> {
      return db
        .updateTable('project')
        .set({ ...patch, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type ProjectsRepository = ReturnType<typeof createProjectsRepository>;
