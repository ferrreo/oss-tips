import { DiscordLinkRequestSchema, DiscordLinkSchema } from '@oss-tips/api-contracts';
import { emailNotificationJob, enqueueDiscordRoleSyncJob } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, problem, readJson, requireSession } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  createDiscordOAuthState,
  discordCallbackUrl,
  discordStateFingerprint,
  discordStateIdentifier,
  discordStateCookie,
  sameOriginCallback,
  verifyDiscordOAuthState,
} from '../oauth';

async function findProjectId(
  db: ReturnType<typeof getDb>,
  userId: string,
  requestedProjectId: string | undefined,
): Promise<string | null> {
  const payment = await db
    .selectFrom('payment')
    .select('project_id')
    .where('user_id', '=', userId)
    .where('status', '=', 'succeeded')
    .$if(Boolean(requestedProjectId), (query) =>
      query.where('project_id', '=', requestedProjectId as string),
    )
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  if (payment) return payment.project_id;

  const membership = await db
    .selectFrom('subscription')
    .select('project_id')
    .where('user_id', '=', userId)
    .where('status', 'in', ['active', 'grace'])
    .$if(Boolean(requestedProjectId), (query) =>
      query.where('project_id', '=', requestedProjectId as string),
    )
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  return membership?.project_id ?? null;
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return problem(503, 'Discord unavailable', 'Discord integration is not configured');
  }
  const body = await readJson(event.request, DiscordLinkRequestSchema);
  if (body instanceof Response) return body;
  const callback = discordCallbackUrl();
  const baseUrl = process.env.PUBLIC_APP_URL;
  if (!callback || !baseUrl) {
    return problem(503, 'Discord unavailable', 'PUBLIC_APP_URL is required');
  }
  try {
    if (process.env.NODE_ENV === 'production' && new URL(baseUrl).protocol !== 'https:') {
      return problem(503, 'Discord unavailable', 'PUBLIC_APP_URL must use HTTPS');
    }
  } catch {
    return problem(503, 'Discord unavailable', 'PUBLIC_APP_URL is invalid');
  }
  const callbackUrl = body.redirect_url
    ? sameOriginCallback(body.redirect_url, baseUrl)
    : (() => {
        try {
          return `${new URL(baseUrl).toString().replace(/\/$/, '')}/me/support`;
        } catch {
          return null;
        }
      })();
  if (!callbackUrl)
    return problem(400, 'Invalid redirect URL', 'Redirect must use this app origin');

  const db = getDb();
  const projectId = await findProjectId(db, session.userId, body.project_id);
  if (!projectId) {
    return problem(
      400,
      'Project context required',
      'A successful support or active membership is required',
    );
  }
  const state = createDiscordOAuthState({
    userId: session.userId,
    projectId,
    callbackUrl,
  });
  if (!state) return problem(503, 'Discord unavailable', 'OAuth state signing is not configured');
  const statePayload = verifyDiscordOAuthState(state);
  if (!statePayload) return problem(503, 'Discord unavailable', 'OAuth state signing failed');
  try {
    await db
      .insertInto('verification')
      .values({
        id: uuidv7(),
        identifier: discordStateIdentifier(statePayload),
        value: discordStateFingerprint(state),
        expires_at: new Date(statePayload.expiresAt * 1000),
      })
      .execute();
  } catch {
    return problem(503, 'Discord unavailable', 'Unable to persist OAuth state');
  }

  const authorization = new URL('https://discord.com/oauth2/authorize');
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  authorization.searchParams.set('scope', 'identify');
  authorization.searchParams.set('redirect_uri', callback);
  authorization.searchParams.set('state', state);
  const response = DiscordLinkSchema.parse({ redirect_url: authorization.toString() });
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': discordStateCookie(state, new URL(baseUrl).protocol === 'https:'),
    },
  });
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const db = getDb();
  await db.transaction().execute(async (trx) => {
    const rows = await trx
      .deleteFrom('discord_connection')
      .where('user_id', '=', session.userId)
      .returning(['id', 'project_id', 'discord_user_id'])
      .execute();
    for (const row of rows) {
      const guilds = await trx
        .selectFrom('discord_guild')
        .select('id')
        .where('project_id', '=', row.project_id)
        .where('bot_installed', '=', true)
        .execute();
      for (const guild of guilds) {
        await enqueueDiscordRoleSyncJob(trx, {
          projectId: row.project_id,
          userId: session.userId,
          discordGuildId: guild.id,
          discordUserId: row.discord_user_id,
        });
      }
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: session.userId },
            {
              action: 'discord.unlinked',
              resourceType: 'discord_connection',
              resourceId: row.id,
              projectId: row.project_id,
            },
          ),
        )
        .execute();
      const securityEventId = uuidv7();
      await trx
        .insertInto('user_security_event')
        .values({
          id: securityEventId,
          user_id: session.userId,
          event_type: 'account.security_changed',
          ip_address: null,
          user_agent: null,
          metadata: { action: 'discord_unlinked', project_id: row.project_id },
        })
        .execute();
      await trx
        .insertInto('job')
        .values(
          emailNotificationJob({
            notification: 'security-change',
            user_id: session.userId,
            event_id: securityEventId,
            action: 'discord_unlinked',
          }),
        )
        .execute();
    }
  });
  return new Response(null, { status: 204 });
};
