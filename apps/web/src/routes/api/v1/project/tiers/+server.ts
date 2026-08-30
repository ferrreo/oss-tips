import { ProjectTierCreateSchema, TierSchema } from '@oss-tips/api-contracts';
import {
  DiscordGuildRequiredError,
  enqueueDiscordRoleSyncForProject,
  replaceTierDiscordRoleMappings,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { listProjectTiers } from './tiers-utils';

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorizeProject(event, getDb(), 'project.manage_tiers', 'tiers:read');
  if (access instanceof Response) return access;
  return json(await listProjectTiers(getDb(), access.projectId), {
    headers: { 'cache-control': 'private, no-store' },
  });
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_tiers', 'tiers:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectTierCreateSchema);
  if (body instanceof Response) return body;
  const project = await db
    .selectFrom('project')
    .select(['default_currency'])
    .where('id', '=', access.projectId)
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');
  const currency = project.default_currency.toLowerCase();
  for (const amount of [body.monthly_amount, body.annual_amount, body.one_off_amount]) {
    if (amount && amount.currency !== currency) {
      return problem(400, 'Invalid tier currency', `Use ${currency} for this project`);
    }
  }

  let tier: { id: string };
  try {
    tier = await db.transaction().execute(async (trx) => {
      const activeCount = await trx
        .selectFrom('tier')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('project_id', '=', access.projectId)
        .where('is_active', '=', true)
        .executeTakeFirstOrThrow();
      if (Number(activeCount.count) >= 8) throw new TierLimitError();
      const id = uuidv7();
      const row = await trx
        .insertInto('tier')
        .values({
          id,
          project_id: access.projectId,
          name: body.name,
          slug: tierSlug(body.name, id),
          description: body.description ?? null,
          rank: body.rank,
          is_active: true,
          one_off_duration: body.one_off_duration ?? null,
          icon: body.icon ?? null,
          member_cap: body.member_cap ?? null,
          minimum_visibility: body.minimum_visibility,
          badge: body.badge ?? null,
          discord_role_ids: body.discord_roles,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const prices = [
        ...(body.monthly_amount ? [{ cadence: 'monthly', value: body.monthly_amount }] : []),
        ...(body.annual_amount ? [{ cadence: 'annual', value: body.annual_amount }] : []),
        ...(body.one_off_amount ? [{ cadence: 'one_off', value: body.one_off_amount }] : []),
      ];
      if (prices.length) {
        await trx
          .insertInto('tier_price')
          .values(
            prices.map(({ cadence, value }) => ({
              id: uuidv7(),
              tier_id: row.id,
              currency: value.currency,
              amount_minor: value.amount,
              cadence,
              stripe_price_binding_id: null,
              is_active: true,
            })),
          )
          .execute();
      }
      if (body.benefits?.length) {
        await trx
          .insertInto('tier_reward')
          .values(
            body.benefits.map((label) => ({
              id: uuidv7(),
              tier_id: row.id,
              reward_type: 'benefit',
              label,
              description: null,
              metadata: {},
            })),
          )
          .execute();
      }
      await replaceTierDiscordRoleMappings(trx, {
        projectId: access.projectId,
        tierId: row.id,
        roleIds: body.discord_roles,
        ...(body.discord_guild_id ? { discordGuildId: body.discord_guild_id } : {}),
      });
      if (body.discord_roles.length > 0) {
        await enqueueDiscordRoleSyncForProject(trx, access.projectId);
      }
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'tier.created',
              resourceType: 'tier',
              resourceId: row.id,
              projectId: access.projectId,
              metadata: { name: row.name, rank: row.rank },
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
          payload: { project_id: access.projectId, tier_id: row.id, change: 'created' },
          published_at: null,
        })
        .execute();
      return row;
    });
  } catch (error) {
    if (error instanceof TierLimitError) return problem(409, 'Tier limit reached', error.message);
    if (error instanceof DiscordGuildRequiredError)
      return problem(409, 'Discord guild required', error.message);
    throw error;
  }

  const tiers = await listProjectTiers(db, access.projectId);
  const created = tiers.find((item) => item.id === tier.id);
  if (!created) return problem(500, 'Tier could not be loaded');
  return json(TierSchema.parse(created), {
    status: 201,
    headers: { 'cache-control': 'private, no-store' },
  });
};

class TierLimitError extends Error {
  constructor() {
    super('A project can have at most eight active tiers');
  }
}

function tierSlug(name: string, id: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tier';
  return `${base.slice(0, 54)}-${id.slice(0, 8)}`;
}
