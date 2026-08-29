import type { Db } from '../client.js';
import type { Entitlement, NewEntitlement } from '../types.js';

export function createEntitlementsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Entitlement | undefined> {
      return db
        .selectFrom('entitlement')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findByTransitionKey(transitionKey: string): Promise<Entitlement | undefined> {
      return db
        .selectFrom('entitlement')
        .selectAll()
        .where('transition_key', '=', transitionKey)
        .executeTakeFirst();
    },

    async listActiveForUser(projectId: string, userId: string): Promise<Entitlement[]> {
      const now = new Date();
      return db
        .selectFrom('entitlement')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null)
        .where((eb) =>
          eb.or([eb('ends_at', 'is', null), eb('ends_at', '>', now)]),
        )
        .where('starts_at', '<=', now)
        .orderBy('tier_rank', 'desc')
        .execute();
    },

    async create(entitlement: NewEntitlement): Promise<Entitlement> {
      return db
        .insertInto('entitlement')
        .values(entitlement)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async revoke(id: string, revokedAt = new Date()): Promise<Entitlement | undefined> {
      return db
        .updateTable('entitlement')
        .set({ revoked_at: revokedAt, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type EntitlementsRepository = ReturnType<typeof createEntitlementsRepository>;
