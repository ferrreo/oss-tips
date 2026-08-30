import { ProjectTierPatchSchema } from '@oss-tips/api-contracts';
import {
  DiscordGuildRequiredError,
  enqueueDiscordRoleSyncForProject,
  replaceTierDiscordRoleMappings,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { listProjectTiers, normalizeDuration } from '../tiers-utils';

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_tiers', 'tiers:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectTierPatchSchema);
  if (body instanceof Response) return body;
  if (Object.keys(body).length === 0) return problem(400, 'Empty tier update');

  const current = await db
    .selectFrom('tier')
    .innerJoin('project', 'project.id', 'tier.project_id')
    .select(['tier.id', 'tier.name', 'tier.rank', 'tier.is_active', 'project.default_currency'])
    .where('tier.id', '=', event.params.id)
    .where('tier.project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!current || !current.is_active) return problem(404, 'Tier not found');
  const currency = current.default_currency.toLowerCase();

  const amountFor = (
    objectValue: { amount: string; currency: string } | null | undefined,
    minorValue: number | undefined,
  ) => {
    if (objectValue !== undefined) return objectValue;
    return minorValue === undefined ? undefined : { amount: String(minorValue), currency };
  };
  const amounts = {
    monthly: amountFor(body.monthly_amount, body.monthly_amount_minor),
    annual: amountFor(body.annual_amount, body.annual_amount_minor),
    one_off: body.one_off_amount,
  } as const;
  for (const amount of Object.values(amounts)) {
    if (amount && amount.currency !== currency) {
      return problem(400, 'Invalid tier currency', `Use ${currency} for this project`);
    }
  }

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('tier')
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.rank !== undefined ? { rank: body.rank } : {}),
          ...(body.one_off_duration !== undefined
            ? { one_off_duration: normalizeDuration(body.one_off_duration) }
            : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
          ...(body.member_cap !== undefined ? { member_cap: body.member_cap } : {}),
          ...(body.minimum_visibility !== undefined
            ? { minimum_visibility: body.minimum_visibility }
            : {}),
          ...(body.discord_roles !== undefined ? { discord_role_ids: body.discord_roles } : {}),
          ...(body.badge !== undefined ? { badge: body.badge } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', current.id)
        .execute();

      for (const [cadence, amount] of Object.entries(amounts)) {
        if (amount === undefined) continue;
        const existing = await trx
          .selectFrom('tier_price')
          .select(['id', 'stripe_price_binding_id'])
          .where('tier_id', '=', current.id)
          .where('cadence', '=', cadence)
          .where('is_active', '=', true)
          .orderBy('created_at', 'desc')
          .executeTakeFirst();
        if (amount === null) {
          if (existing) {
            await trx
              .updateTable('tier_price')
              .set({ is_active: false, updated_at: new Date() })
              .where('id', '=', existing.id)
              .execute();
          }
        } else if (existing?.stripe_price_binding_id) {
          await trx
            .updateTable('tier_price')
            .set({ is_active: false, updated_at: new Date() })
            .where('id', '=', existing.id)
            .execute();
          await trx
            .insertInto('tier_price')
            .values({
              id: uuidv7(),
              tier_id: current.id,
              currency,
              amount_minor: amount.amount,
              cadence,
              stripe_price_binding_id: null,
              is_active: true,
            })
            .execute();
        } else if (existing) {
          await trx
            .updateTable('tier_price')
            .set({ amount_minor: amount.amount, currency, updated_at: new Date() })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await trx
            .insertInto('tier_price')
            .values({
              id: uuidv7(),
              tier_id: current.id,
              currency,
              amount_minor: amount.amount,
              cadence,
              stripe_price_binding_id: null,
              is_active: true,
            })
            .execute();
        }
      }

      if (body.benefits !== undefined) {
        await trx.deleteFrom('tier_reward').where('tier_id', '=', current.id).execute();
        if (body.benefits.length) {
          await trx
            .insertInto('tier_reward')
            .values(
              body.benefits.map((label) => ({
                id: uuidv7(),
                tier_id: current.id,
                reward_type: 'benefit',
                label,
                description: null,
                metadata: {},
              })),
            )
            .execute();
        }
      }
      if (body.discord_roles !== undefined) {
        await replaceTierDiscordRoleMappings(trx, {
          projectId: access.projectId,
          tierId: current.id,
          roleIds: body.discord_roles,
          ...(body.discord_guild_id ? { discordGuildId: body.discord_guild_id } : {}),
        });
        await enqueueDiscordRoleSyncForProject(trx, access.projectId);
      }
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'tier.updated',
              resourceType: 'tier',
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
          payload: { project_id: access.projectId, tier_id: current.id, change: 'updated' },
          published_at: null,
        })
        .execute();
    });
  } catch (error) {
    if (error instanceof DiscordGuildRequiredError)
      return problem(409, 'Discord guild required', error.message);
    throw error;
  }

  const tier = (await listProjectTiers(db, access.projectId)).find(
    (item) => item.id === current.id,
  );
  return tier
    ? json(tier, { headers: { 'cache-control': 'private, no-store' } })
    : problem(404, 'Tier not found');
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_tiers', 'tiers:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const tier = await db
    .selectFrom('tier')
    .select(['id', 'is_active'])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!tier || !tier.is_active) return problem(404, 'Tier not found');
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('tier')
      .set({ is_active: false, updated_at: new Date() })
      .where('id', '=', tier.id)
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'tier.archived',
            resourceType: 'tier',
            resourceId: tier.id,
            projectId: access.projectId,
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
        payload: { project_id: access.projectId, tier_id: tier.id, change: 'archived' },
        published_at: null,
      })
      .execute();
  });
  return new Response(null, { status: 204 });
};
