import { encryptWebhookSecret } from '@oss-tips/api-contracts/security';
import { emailNotificationJob, enqueueDiscordRoleSyncForUser } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, problem, requireSession } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { discordTokenEncryptionKey } from '$lib/server/runtime-config';
import {
  clearDiscordStateCookie,
  discordCallbackUrl,
  discordStateFingerprint,
  discordStateIdentifier,
  DISCORD_STATE_COOKIE,
  sameOriginCallback,
  verifyDiscordOAuthState,
} from '../../oauth';

function stateCookie(request: Request): string | null {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split('=');
    if (name === DISCORD_STATE_COOKIE) return value.join('=') || null;
  }
  return null;
}

function secureCookie(): boolean {
  const callback = discordCallbackUrl();
  return callback?.startsWith('https:') ?? process.env.NODE_ENV === 'production';
}

function clearState(response: Response): Response {
  response.headers.set('set-cookie', clearDiscordStateCookie(secureCookie()));
  return response;
}

function failure(status: number, title: string, detail?: string): Response {
  return clearState(problem(status, title, detail));
}

async function jsonBody(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function encryptedToken(value: string, key: string): string | null {
  try {
    return encryptWebhookSecret(value, key);
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return failure(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return failure(503, 'Discord unavailable', 'Discord integration is not configured');
  }

  const rawState = stateCookie(event.request);
  const queryState = event.url.searchParams.get('state');
  const state = verifyDiscordOAuthState(rawState);
  if (!state || !queryState || queryState !== rawState || state.userId !== session.userId) {
    return failure(400, 'Invalid Discord OAuth state', 'Start linking again from your account');
  }
  const code = event.url.searchParams.get('code');
  if (!code || code.length > 2048) {
    return failure(400, 'Discord authorization failed', 'Authorization code is missing or invalid');
  }
  const callback = discordCallbackUrl();
  if (!callback) return failure(503, 'Discord unavailable', 'PUBLIC_APP_URL is required');
  const encryptionKey = discordTokenEncryptionKey();
  if (!encryptionKey) {
    return failure(503, 'Discord unavailable', 'DISCORD_TOKEN_ENCRYPTION_KEY is required');
  }

  const db = getDb();
  try {
    const consumed = await db.transaction().execute(async (trx) => {
      const stored = await trx
        .selectFrom('verification')
        .select('id')
        .where('identifier', '=', discordStateIdentifier(state))
        .where('value', '=', discordStateFingerprint(rawState as string))
        .where('expires_at', '>', new Date())
        .forUpdate()
        .executeTakeFirst();
      if (!stored) return false;
      await trx.deleteFrom('verification').where('id', '=', stored.id).execute();
      return true;
    });
    if (!consumed)
      return failure(400, 'Invalid Discord OAuth state', 'Start linking again from your account');
  } catch {
    return failure(503, 'Discord unavailable', 'Unable to verify OAuth state');
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: callback,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return failure(502, 'Discord unavailable', 'Token exchange failed');
  }
  if (!tokenResponse.ok)
    return failure(502, 'Discord authorization failed', 'Token exchange rejected');
  const tokenPayload = await jsonBody(tokenResponse);
  if (
    !tokenPayload ||
    typeof tokenPayload !== 'object' ||
    typeof (tokenPayload as { access_token?: unknown }).access_token !== 'string'
  ) {
    return failure(502, 'Discord authorization failed', 'Token response was invalid');
  }
  const accessToken = (tokenPayload as { access_token: string }).access_token;
  const refreshToken =
    typeof (tokenPayload as { refresh_token?: unknown }).refresh_token === 'string'
      ? (tokenPayload as { refresh_token: string }).refresh_token
      : null;
  const encryptedAccessToken = encryptedToken(accessToken, encryptionKey);
  const encryptedRefreshToken = refreshToken ? encryptedToken(refreshToken, encryptionKey) : null;
  if (!encryptedAccessToken || (refreshToken && !encryptedRefreshToken)) {
    return failure(503, 'Discord unavailable', 'Token encryption is not configured correctly');
  }

  let userResponse: Response;
  try {
    userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      redirect: 'error',
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return failure(502, 'Discord unavailable', 'Discord profile lookup failed');
  }
  if (!userResponse.ok)
    return failure(502, 'Discord authorization failed', 'Discord profile lookup rejected');
  const userPayload = await jsonBody(userResponse);
  if (
    !userPayload ||
    typeof userPayload !== 'object' ||
    typeof (userPayload as { id?: unknown }).id !== 'string' ||
    !(userPayload as { id: string }).id.trim() ||
    (userPayload as { id: string }).id.length > 64
  ) {
    return failure(502, 'Discord authorization failed', 'Discord profile response was invalid');
  }
  const discordUserId = (userPayload as { id: string }).id;
  try {
    await db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom('discord_connection')
        .select('id')
        .where('project_id', '=', state.projectId)
        .where('user_id', '=', session.userId)
        .forUpdate()
        .executeTakeFirst();
      let connectionId: string;
      if (existing) {
        connectionId = existing.id;
        await trx
          .updateTable('discord_connection')
          .set({
            discord_user_id: discordUserId,
            access_token_encrypted: encryptedAccessToken,
            refresh_token_encrypted: encryptedRefreshToken,
            scopes: ['identify'],
            updated_at: new Date(),
          })
          .where('id', '=', existing.id)
          .execute();
      } else {
        connectionId = uuidv7();
        await trx
          .insertInto('discord_connection')
          .values({
            id: connectionId,
            project_id: state.projectId,
            user_id: session.userId,
            discord_user_id: discordUserId,
            access_token_encrypted: encryptedAccessToken,
            refresh_token_encrypted: encryptedRefreshToken,
            scopes: ['identify'],
            connected_at: new Date(),
          })
          .execute();
      }
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: session.userId },
            {
              action: 'discord.linked',
              resourceType: 'discord_connection',
              resourceId: connectionId,
              projectId: state.projectId,
              metadata: { discord_user_id: discordUserId },
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
          metadata: { action: 'discord_linked', project_id: state.projectId },
        })
        .execute();
      await trx
        .insertInto('job')
        .values(
          emailNotificationJob({
            notification: 'security-change',
            user_id: session.userId,
            event_id: securityEventId,
            action: 'discord_linked',
          }),
        )
        .execute();
      await enqueueDiscordRoleSyncForUser(trx, {
        projectId: state.projectId,
        userId: session.userId,
      });
    });
  } catch {
    return failure(503, 'Discord unavailable', 'Unable to save Discord connection');
  }

  const redirectUrl = sameOriginCallback(state.callbackUrl, process.env.PUBLIC_APP_URL ?? '');
  if (!redirectUrl) return failure(400, 'Invalid redirect URL');
  const target = new URL(redirectUrl);
  target.searchParams.set('discord', 'linked');
  return clearState(
    new Response(null, {
      status: 303,
      headers: { location: target.toString() },
    }),
  );
};
