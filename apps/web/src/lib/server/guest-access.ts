import {
  consumeMessageRateLimit,
  createGuestAccessRepository,
  enqueueDiscordRoleSyncForUser,
  hashGuestEmail,
  isMessageBlocked,
  messageActorKey,
  normalizeGuestEmail,
  projectMessageKey,
  type NewAuditEvent,
  statusOfGuestAccessToken,
  type Db,
  type GuestAccessToken,
} from '@oss-tips/db';
import { currencyExponent, uuidv7 } from '@oss-tips/domain';
import type { Project, Thread } from '@oss-tips/ui';

export type GuestPageState = 'valid' | 'pending' | 'expired' | 'used' | 'invalid' | 'unavailable';

export type GuestProjectPreview = Pick<Project, 'name' | 'currency'>;

export type GuestClaimPageData = {
  accessState: GuestPageState;
  project: GuestProjectPreview | null;
  amountMinor: number;
  cadence: string;
  reference: string;
  expires: string;
};

export type GuestReplyPageData = {
  accessState: GuestPageState;
  project: GuestProjectPreview | null;
  thread: Thread | null;
  expires: string;
};

export type GuestClaimResult =
  | { kind: 'claimed'; paymentId: string }
  | { kind: 'pending' | 'invalid' | 'expired' | 'used' | 'conflict' };

export type GuestReplyResult =
  | { kind: 'sent'; messageId: string }
  | { kind: 'invalid' | 'expired' | 'used' }
  | { kind: 'blocked' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

function guestAudit(
  action: string,
  projectId: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number> = {},
): NewAuditEvent {
  const metadataRedacted = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key === 'scope' || key === 'retry_after_seconds'),
  );
  return {
    id: uuidv7(),
    actor_id: null,
    actor_type: 'guest',
    session_id: null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    project_id: projectId,
    reason: null,
    ip_hash: null,
    before_hash: null,
    after_hash: null,
    correlation_id: uuidv7(),
    metadata_redacted: metadataRedacted,
  };
}

export function guestTimestamp(value: Date): string {
  // Formatting belongs to the locale-aware UI; keep server data locale-neutral.
  return value.toISOString();
}

function dateLabel(value: Date): string {
  return guestTimestamp(value);
}

function guestState(token: GuestAccessToken | undefined): GuestPageState {
  const status = statusOfGuestAccessToken(token);
  if (status === 'expired') return 'expired';
  if (status === 'used') return 'used';
  return status === 'valid' ? 'valid' : 'invalid';
}

function numberMinor(value: string | number | bigint | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isSafeInteger(number) ? number : 0;
}

export async function loadGuestClaimPage(db: Db, rawToken: string): Promise<GuestClaimPageData> {
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(rawToken);
  const accessState = guestState(token);
  if (!token || token.kind !== 'claim' || accessState !== 'valid' || !token.payment_id) {
    return {
      accessState: token?.kind === 'claim' ? accessState : 'invalid',
      project: null,
      amountMinor: 0,
      cadence: 'one-off',
      reference: '',
      expires: token ? dateLabel(token.expires_at) : '',
    };
  }

  const payment = await db
    .selectFrom('payment')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .select([
      'payment.id',
      'payment.project_id',
      'payment.customer_charge_minor',
      'payment.cadence',
      'payment.currency',
      'payment.status',
      'project.name as project_name',
    ])
    .where('payment.id', '=', token.payment_id)
    .executeTakeFirst();
  if (!payment) {
    return {
      accessState: 'invalid',
      project: null,
      amountMinor: 0,
      cadence: 'one-off',
      reference: '',
      expires: dateLabel(token.expires_at),
    };
  }

  if (payment.status !== 'succeeded') {
    return {
      accessState: 'pending',
      project: { name: payment.project_name, currency: payment.currency.toUpperCase() },
      amountMinor: numberMinor(payment.customer_charge_minor),
      cadence: payment.cadence,
      reference: payment.id,
      expires: dateLabel(token.expires_at),
    };
  }

  return {
    accessState: 'valid',
    project: { name: payment.project_name, currency: payment.currency.toUpperCase() },
    amountMinor: numberMinor(payment.customer_charge_minor),
    cadence: payment.cadence,
    reference: payment.id,
    expires: dateLabel(token.expires_at),
  };
}

export async function loadGuestReplyPage(db: Db, rawToken: string): Promise<GuestReplyPageData> {
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(rawToken);
  const accessState = guestState(token);
  if (!token || token.kind !== 'reply' || accessState !== 'valid' || !token.thread_id) {
    return {
      accessState: token?.kind === 'reply' ? accessState : 'invalid',
      project: null,
      thread: null,
      expires: token ? dateLabel(token.expires_at) : '',
    };
  }

  const threadRow = await db
    .selectFrom('supporter_message_thread as thread')
    .innerJoin('project', 'project.id', 'thread.project_id')
    .innerJoin('payment', 'payment.id', 'thread.payment_id')
    .select([
      'thread.id',
      'thread.status',
      'thread.created_at',
      'thread.updated_at',
      'project.name as project_name',
      'project.default_currency as project_currency',
      'payment.customer_charge_minor',
      'payment.currency as payment_currency',
      'payment.cadence',
    ])
    .where('thread.id', '=', token.thread_id)
    .where('payment.status', '=', 'succeeded')
    .executeTakeFirst();
  if (!threadRow) {
    return {
      accessState: 'invalid',
      project: null,
      thread: null,
      expires: dateLabel(token.expires_at),
    };
  }

  const messages = await db
    .selectFrom('supporter_message')
    .select(['id', 'author_user_id', 'author_name', 'body', 'created_at'])
    .where('thread_id', '=', threadRow.id)
    .where('is_internal', '=', false)
    .orderBy('created_at', 'asc')
    .execute();
  const currency = (threadRow.payment_currency ?? threadRow.project_currency).toUpperCase();
  const cadence = threadRow.cadence ?? 'one-off';
  const firstMessage = messages[0]?.body ?? 'Support conversation';
  const thread: Thread = {
    id: threadRow.id,
    subject: 'Support conversation',
    project: threadRow.project_name,
    supporter: 'Guest supporter',
    amountMinor: numberMinor(threadRow.customer_charge_minor),
    amountLabel: `${currency} ${numberMinor(threadRow.customer_charge_minor) / 10 ** currencyExponent(currency)}`,
    cadence,
    relativeTime: dateLabel(threadRow.updated_at),
    preview: firstMessage,
    status: threadRow.status,
    messages: messages.map((message) => ({
      id: message.id,
      author: message.author_name ?? (message.author_user_id ? 'Project team' : 'Guest supporter'),
      body: message.body,
      timestamp: message.created_at.toISOString(),
      relativeTime: dateLabel(message.created_at),
    })),
  };

  return {
    accessState: 'valid',
    project: { name: threadRow.project_name, currency },
    thread,
    expires: dateLabel(token.expires_at),
  };
}

export async function claimGuestPayment(
  db: Db,
  rawToken: string,
  userId: string,
  email: string,
): Promise<GuestClaimResult> {
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(rawToken);
  if (!token || token.kind !== 'claim') return { kind: 'invalid' };
  const state = guestState(token);
  if (state === 'expired') return { kind: 'expired' };
  if (state === 'used') return { kind: 'used' };
  if (state !== 'valid') return { kind: 'invalid' };
  if (hashGuestEmail(normalizeGuestEmail(email)) !== token.email_hash) {
    await repository.recordFailedAttempt(rawToken);
    return { kind: 'invalid' };
  }

  return db.transaction().execute(async (transaction) => {
    const lockedToken = await transaction
      .selectFrom('guest_access_token')
      .selectAll()
      .where('id', '=', token.id)
      .forUpdate()
      .executeTakeFirst();
    if (!lockedToken) return { kind: 'invalid' };
    const lockedState = guestState(lockedToken);
    if (lockedState === 'expired') return { kind: 'expired' };
    if (lockedState === 'used') return { kind: 'used' };
    if (
      lockedState !== 'valid' ||
      hashGuestEmail(normalizeGuestEmail(email)) !== lockedToken.email_hash
    ) {
      return { kind: 'invalid' };
    }
    if (!lockedToken.payment_id) return { kind: 'invalid' };

    const payment = await transaction
      .selectFrom('payment')
      .select([
        'id',
        'project_id',
        'user_id',
        'status',
        'cadence',
        'public_show_name',
        'public_show_amount',
        'public_show_message',
        'public_display_name',
        'public_message',
      ])
      .where('id', '=', lockedToken.payment_id)
      .forUpdate()
      .executeTakeFirst();
    if (!payment) return { kind: 'invalid' };
    if (payment.status !== 'succeeded') return { kind: 'pending' };
    if (payment.cadence !== 'one_off') return { kind: 'invalid' };
    if (payment.user_id && payment.user_id !== userId) return { kind: 'conflict' };

    const now = new Date();
    await transaction
      .updateTable('payment')
      .set({ user_id: userId, updated_at: now })
      .where('id', '=', payment.id)
      .execute();
    await transaction
      .updateTable('entitlement')
      .set({ user_id: userId, updated_at: now })
      .where('payment_id', '=', payment.id)
      .where('user_id', 'is', null)
      .execute();
    await enqueueDiscordRoleSyncForUser(transaction, {
      projectId: payment.project_id,
      userId,
    });
    await transaction
      .updateTable('supporter_message_thread')
      .set({ supporter_user_id: userId, updated_at: now })
      .where('payment_id', '=', payment.id)
      .where('supporter_user_id', 'is', null)
      .execute();
    const existingProfile = await transaction
      .selectFrom('supporter_public_profile')
      .select(['id', 'display_name'])
      .where('project_id', '=', payment.project_id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (existingProfile) {
      await transaction
        .updateTable('supporter_public_profile')
        .set({
          show_name: payment.public_show_name,
          show_amount: payment.public_show_amount,
          show_message: payment.public_show_message,
          ...(existingProfile.display_name === null && payment.public_display_name
            ? { display_name: payment.public_display_name }
            : {}),
          updated_at: now,
        })
        .where('id', '=', existingProfile.id)
        .execute();
    } else if (
      payment.public_show_name ||
      payment.public_show_amount ||
      payment.public_show_message
    ) {
      await transaction
        .insertInto('supporter_public_profile')
        .values({
          id: uuidv7(),
          user_id: userId,
          project_id: payment.project_id,
          display_name: payment.public_display_name,
          show_name: payment.public_show_name,
          show_amount: payment.public_show_amount,
          show_message: payment.public_show_message,
        })
        .execute();
    }
    await transaction
      .updateTable('guest_access_token')
      .set({ used_at: now })
      .where('id', '=', lockedToken.id)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    return { kind: 'claimed', paymentId: payment.id };
  });
}

export async function appendGuestReply(
  db: Db,
  rawToken: string,
  body: string,
): Promise<GuestReplyResult> {
  const cleanBody = body.trim();
  if (
    !cleanBody ||
    cleanBody.length > 2000 ||
    /(?:https?|ftp|javascript|data):|www\./i.test(cleanBody)
  ) {
    return { kind: 'invalid' };
  }
  const repository = createGuestAccessRepository(db);
  const token = await repository.find(rawToken);
  if (!token || token.kind !== 'reply') return { kind: 'invalid' };
  const state = guestState(token);
  if (state === 'expired') return { kind: 'expired' };
  if (state === 'used') return { kind: 'used' };
  if (state !== 'valid' || !token.thread_id) return { kind: 'invalid' };

  return db.transaction().execute(async (transaction) => {
    const lockedToken = await transaction
      .selectFrom('guest_access_token')
      .selectAll()
      .where('id', '=', token.id)
      .forUpdate()
      .executeTakeFirst();
    if (!lockedToken || !lockedToken.thread_id) return { kind: 'invalid' };
    const lockedState = guestState(lockedToken);
    if (lockedState === 'expired') return { kind: 'expired' };
    if (lockedState === 'used') return { kind: 'used' };
    if (lockedState !== 'valid') return { kind: 'invalid' };

    const thread = await transaction
      .selectFrom('supporter_message_thread as thread')
      .innerJoin('payment', 'payment.id', 'thread.payment_id')
      .select([
        'thread.id',
        'thread.project_id',
        'thread.status',
        'payment.status as payment_status',
      ])
      .where('thread.id', '=', lockedToken.thread_id)
      .where('payment.status', '=', 'succeeded')
      .forUpdate()
      .executeTakeFirst();
    if (!thread || thread.status !== 'open' || thread.payment_status !== 'succeeded') {
      return { kind: 'invalid' };
    }

    const actorKey = messageActorKey({ kind: 'guest', emailHash: lockedToken.email_hash });
    const targetKey = projectMessageKey(thread.project_id);
    if (
      await isMessageBlocked(transaction, {
        projectId: thread.project_id,
        threadId: thread.id,
        actorKey,
        targetKey,
      })
    ) {
      await transaction
        .insertInto('audit_event')
        .values(
          guestAudit(
            'guest.message_blocked_attempt',
            thread.project_id,
            'supporter_message_thread',
            thread.id,
          ),
        )
        .execute();
      return { kind: 'blocked' };
    }
    const rate = await consumeMessageRateLimit(transaction, {
      threadId: thread.id,
      projectId: thread.project_id,
      actor: { kind: 'guest', emailHash: lockedToken.email_hash },
    });
    if (!rate.allowed) {
      await transaction
        .insertInto('audit_event')
        .values(
          guestAudit(
            'guest.message_rate_limited',
            thread.project_id,
            'supporter_message_thread',
            thread.id,
            {
              scope: rate.scope ?? 'unknown',
              retry_after_seconds: rate.retryAfterSeconds,
            },
          ),
        )
        .execute();
      return { kind: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds };
    }

    const message = await transaction
      .insertInto('supporter_message')
      .values({
        id: uuidv7(),
        thread_id: thread.id,
        author_user_id: null,
        author_name: null,
        body: cleanBody,
        is_internal: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const now = new Date();
    await transaction
      .updateTable('supporter_message_thread')
      .set({ updated_at: now })
      .where('id', '=', thread.id)
      .execute();
    await transaction
      .updateTable('guest_access_token')
      .set({ used_at: now })
      .where('id', '=', lockedToken.id)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    await transaction
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'thread',
        aggregate_id: thread.id,
        event_type: 'supporter.message_received',
        payload: { project_id: thread.project_id, thread_id: thread.id, message_id: message.id },
        published_at: null,
      })
      .execute();
    await transaction
      .insertInto('audit_event')
      .values(guestAudit('guest.message_sent', thread.project_id, 'supporter_message', message.id))
      .execute();
    return { kind: 'sent', messageId: message.id };
  });
}
