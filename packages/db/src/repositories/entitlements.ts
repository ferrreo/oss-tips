import type { Db } from '../client.js';
import type { Entitlement, NewEntitlement } from '../types.js';

/**
 * Return entitlements that currently grant project access.
 *
 * Membership entitlements follow their subscription state, while one-off
 * entitlements only need their own current, non-revoked window.
 */
export async function listCurrentForProject(
  db: Db,
  projectId: string,
  now = new Date(),
): Promise<Entitlement[]> {
  return db
    .selectFrom('entitlement')
    .leftJoin('subscription', 'subscription.id', 'entitlement.subscription_id')
    .selectAll('entitlement')
    .where('entitlement.project_id', '=', projectId)
    .where('entitlement.revoked_at', 'is', null)
    .where('entitlement.starts_at', '<=', now)
    .where((eb) =>
      eb.or([eb('entitlement.ends_at', 'is', null), eb('entitlement.ends_at', '>', now)]),
    )
    .where((eb) =>
      eb.or([
        eb('entitlement.kind', '=', 'one_off'),
        eb.and([
          eb('entitlement.kind', '=', 'membership'),
          eb('subscription.status', 'in', ['active', 'grace']),
        ]),
      ]),
    )
    .orderBy('entitlement.created_at', 'asc')
    .execute();
}

/** Count distinct supporters represented by current entitlements. */
export function countCurrentEntitlementSupporters(
  entitlements: readonly Pick<Entitlement, 'id' | 'user_id'>[],
): number {
  return new Set(
    entitlements.map((entitlement) => entitlement.user_id ?? `entitlement:${entitlement.id}`),
  ).size;
}

export function createEntitlementsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Entitlement | undefined> {
      return db.selectFrom('entitlement').selectAll().where('id', '=', id).executeTakeFirst();
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
        .where((eb) => eb.or([eb('ends_at', 'is', null), eb('ends_at', '>', now)]))
        .where('starts_at', '<=', now)
        .orderBy('tier_rank', 'desc')
        .execute();
    },

    async listCurrentForProject(projectId: string, now = new Date()): Promise<Entitlement[]> {
      return listCurrentForProject(db, projectId, now);
    },

    async create(entitlement: NewEntitlement): Promise<Entitlement> {
      return db
        .insertInto('entitlement')
        .values(entitlement)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async createIfNew(
      entitlement: NewEntitlement,
    ): Promise<{ entitlement: Entitlement; created: boolean }> {
      const created = await db
        .insertInto('entitlement')
        .values(entitlement)
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst();
      if (created) return { entitlement: created, created: true };
      const existing = await this.findByTransitionKey(entitlement.transition_key);
      if (!existing) throw new Error('Failed to create entitlement');
      return { entitlement: existing, created: false };
    },

    async listBySubscription(subscriptionId: string): Promise<Entitlement[]> {
      return db
        .selectFrom('entitlement')
        .selectAll()
        .where('subscription_id', '=', subscriptionId)
        .orderBy('starts_at', 'desc')
        .execute();
    },

    async setEndsAtForSubscription(subscriptionId: string, endsAt: Date): Promise<Entitlement[]> {
      return db
        .updateTable('entitlement')
        .set({ ends_at: endsAt, updated_at: new Date() })
        .where('subscription_id', '=', subscriptionId)
        .where('revoked_at', 'is', null)
        .where((eb) => eb.or([eb('ends_at', 'is', null), eb('ends_at', '>', endsAt)]))
        .returningAll()
        .execute();
    },

    async revokeForSubscription(
      subscriptionId: string,
      revokedAt = new Date(),
    ): Promise<Entitlement[]> {
      return db
        .updateTable('entitlement')
        .set({ revoked_at: revokedAt, updated_at: revokedAt })
        .where('subscription_id', '=', subscriptionId)
        .where('revoked_at', 'is', null)
        .returningAll()
        .execute();
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
