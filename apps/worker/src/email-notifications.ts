import { createHash, createHmac } from 'node:crypto';
import { computeFeeAllocation, formatMoney, money, uuidv7 } from '@oss-tips/domain';
import { isAuthOtpHash, parseAuthOtpValue, recoverAuthOtp } from '@oss-tips/domain/auth-otp';
import {
  renderApiKeyChangeEmail,
  renderDisputeEmail,
  renderDomainFailureEmail,
  renderMembershipEmail,
  renderProjectReviewEmail,
  renderReceiptEmail,
  renderRefundEmail,
  renderOtpEmail,
  renderSecurityEventEmail,
  renderSecurityChangeEmail,
  renderStripeRestrictionEmail,
  renderWebhookChangeEmail,
  renderThankYouReplyEmail,
  renderTeamInviteEmail,
  SECURITY_CHANGE_ACTIONS,
  securityChangeLabel,
  supportEmailCodeFromVerificationValue,
  supportEmailIdentifier,
  type ApiKeyChange,
  type MembershipEmailEvent,
  type ReviewStatus,
  type SecurityChangeAction,
  type WebhookChange,
} from '@oss-tips/email';
import {
  GUEST_ACCESS_TOKEN_TTL_MS,
  hashGuestAccessToken,
  hashGuestEmail,
  normalizeEmailAddress,
  normalizeGuestEmail,
  type Db,
  type Job,
  type JsonValue,
} from '@oss-tips/db';
import {
  deliverEmail,
  type EmailDeliveryDependencies,
  type EmailRecipient,
} from './email-delivery.js';
import { workerPublicUrl } from './runtime-config.js';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

type Recipient = EmailRecipient;

type EmailNotificationPayload = {
  notification: string;
  [key: string]: string;
};

type EmailNotificationDependencies = EmailDeliveryDependencies & {
  authSecret?: string;
  publicAppUrl?: string;
  jobId?: string;
};

const GUEST_TOKEN_PURPOSES = {
  claim: 'guest-claim',
  reply: 'guest-reply',
} as const;
const SIGN_IN_OTP_IDENTIFIER_PREFIX = 'sign-in-otp-';

type StableGuestToken = { token: string; used: boolean };

function signInOtpEmail(identifier: string): string | null {
  if (!identifier.startsWith(SIGN_IN_OTP_IDENTIFIER_PREFIX)) return null;
  const email = normalizeEmailAddress(identifier.slice(SIGN_IN_OTP_IDENTIFIER_PREFIX.length));
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function publicUrl(dependencies: EmailNotificationDependencies, path: string): string {
  return workerPublicUrl(dependencies.publicAppUrl, path);
}

function stableGuestToken(secret: string, purpose: string, resourceId: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${purpose}:${resourceId}`, 'utf8')
    .digest('base64url');
  return `gat_${digest}`;
}

async function ensureStableGuestToken(
  dependencies: EmailNotificationDependencies,
  input: {
    kind: 'claim' | 'reply';
    resourceId: string;
    paymentId?: string;
    threadId?: string;
    email: string;
  },
): Promise<StableGuestToken | null> {
  const secret = dependencies.authSecret?.trim();
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for guest email links');
  const token = stableGuestToken(secret, GUEST_TOKEN_PURPOSES[input.kind], input.resourceId);
  const now = dependencies.now?.() ?? new Date();
  const email = normalizeGuestEmail(input.email);
  await dependencies.db
    .insertInto('guest_access_token')
    .values({
      id: uuidv7(),
      kind: input.kind,
      token_hash: hashGuestAccessToken(token),
      payment_id: input.paymentId ?? null,
      thread_id: input.threadId ?? null,
      email_hash: hashGuestEmail(email),
      attempt_count: 0,
      expires_at: new Date(now.getTime() + GUEST_ACCESS_TOKEN_TTL_MS),
      used_at: null,
    })
    .onConflict((oc) => oc.column('token_hash').doNothing())
    .execute();
  const record = await dependencies.db
    .selectFrom('guest_access_token')
    .select(['kind', 'payment_id', 'thread_id', 'email_hash', 'expires_at', 'used_at'])
    .where('token_hash', '=', hashGuestAccessToken(token))
    .executeTakeFirst();
  if (
    !record ||
    record.kind !== input.kind ||
    record.payment_id !== (input.paymentId ?? null) ||
    record.thread_id !== (input.threadId ?? null) ||
    record.email_hash !== hashGuestEmail(email)
  ) {
    return null;
  }
  if (record.used_at) return { token, used: true };
  if (record.expires_at <= now) return null;
  return { token, used: false };
}

function payloadOf(job: Job): EmailNotificationPayload {
  if (typeof job.payload !== 'object' || job.payload === null || Array.isArray(job.payload)) {
    throw new Error('Email notification payload must be an object');
  }
  return job.payload as EmailNotificationPayload;
}

function requiredId(payload: EmailNotificationPayload, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new Error(`Email notification payload ${key} is invalid`);
  }
  return value;
}

function requiredValue<T extends string>(
  payload: EmailNotificationPayload,
  key: string,
  values: readonly T[],
): T {
  const value = payload[key];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`Email notification payload ${key} is invalid`);
  }
  return value as T;
}

function recipientKey(recipient: Recipient): string {
  if (recipient.userId) return `user:${recipient.userId}`;
  return `email:${createHash('sha256').update(recipient.email.toLowerCase()).digest('hex')}`;
}

async function projectRecipients(
  db: Db,
  projectId: string,
  requiredCapability: string,
): Promise<Recipient[]> {
  const rows = await db
    .selectFrom('project_member')
    .innerJoin('user', 'user.id', 'project_member.user_id')
    .select([
      'project_member.user_id as user_id',
      'project_member.capabilities',
      'user.email',
      'user.locale',
    ])
    .where('project_member.project_id', '=', projectId)
    .where('user.email_verified', '=', true)
    .distinct()
    .execute();
  return rows
    .filter((row) => row.capabilities.includes(requiredCapability))
    .map((row) => ({ userId: row.user_id, email: row.email, locale: row.locale }));
}

async function deliverProjectNotification(
  dependencies: EmailNotificationDependencies,
  args: {
    projectId: string;
    eventKey: string;
    template: string;
    metadata: JsonValue;
    requiredCapability: string;
    render: (
      projectName: string,
      locale: string,
    ) => { subject: string; html: string; text: string };
  },
): Promise<void> {
  const project = await dependencies.db
    .selectFrom('project')
    .select(['id', 'name'])
    .where('id', '=', args.projectId)
    .executeTakeFirst();
  if (!project) return;
  const recipients = await projectRecipients(
    dependencies.db,
    args.projectId,
    args.requiredCapability,
  );
  for (const recipient of recipients) {
    await deliverEmail(dependencies, {
      recipient,
      dedupeKey: `email:${args.eventKey}:${recipientKey(recipient)}`,
      template: args.template,
      metadata: args.metadata,
      ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
      render: (locale) => args.render(project.name, locale),
    });
  }
}

async function projectReview(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const reviewId = requiredId(payload, 'review_id');
  const status = requiredValue<ReviewStatus>(payload, 'status', [
    'approved',
    'rejected',
    'action_required',
  ]);
  const review = await dependencies.db
    .selectFrom('project_review')
    .select(['id', 'notes'])
    .where('id', '=', reviewId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
  if (!review) return;
  await deliverProjectNotification(dependencies, {
    projectId,
    requiredCapability: 'project.publish_project',
    eventKey: `project-review:${reviewId}:${status}`,
    template: 'project-review',
    metadata: {
      notification: 'project-review',
      project_id: projectId,
      review_id: reviewId,
      status,
    },
    render: (projectName, locale) =>
      renderProjectReviewEmail({
        projectName,
        status,
        ...(review.notes ? { detail: review.notes } : {}),
        locale,
      }),
  });
}

async function apiKeyChange(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const keyId = requiredId(payload, 'api_key_id');
  const action = requiredValue<ApiKeyChange>(payload, 'action', ['created', 'revoked']);
  const key = await dependencies.db
    .selectFrom('api_key')
    .select(['id', 'name'])
    .where('id', '=', keyId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
  if (!key) return;
  await deliverProjectNotification(dependencies, {
    projectId,
    requiredCapability: 'project.manage_api_keys',
    eventKey: `api-key:${keyId}:${action}`,
    template: 'api-key-change',
    metadata: { notification: 'api-key-change', project_id: projectId, api_key_id: keyId, action },
    render: (projectName, locale) =>
      renderApiKeyChangeEmail({ projectName, keyName: key.name, action, locale }),
  });
}

async function webhookChange(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const endpointId = requiredId(payload, 'webhook_endpoint_id');
  const eventId = requiredId(payload, 'event_id');
  const action = requiredValue<WebhookChange>(payload, 'action', [
    'created',
    'updated',
    'removed',
    'secret_rotated',
    'enabled',
    'disabled',
    'status_updated',
  ]);
  const endpoint = await dependencies.db
    .selectFrom('webhook_endpoint')
    .select(['id', 'url'])
    .where('id', '=', endpointId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
  if (!endpoint) return;
  await deliverProjectNotification(dependencies, {
    projectId,
    requiredCapability: 'project.manage_webhooks',
    eventKey: `webhook:${endpointId}:${action}:${eventId}`,
    template: 'webhook-change',
    metadata: {
      notification: 'webhook-change',
      project_id: projectId,
      webhook_endpoint_id: endpointId,
      action,
      event_id: eventId,
    },
    render: (projectName, locale) =>
      renderWebhookChangeEmail({ projectName, endpoint: endpoint.url, action, locale }),
  });
}

async function stripeRestriction(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const restriction = payload.restriction;
  if (typeof restriction !== 'string' || restriction.length === 0 || restriction.length > 200) {
    throw new Error('Email notification payload restriction is invalid');
  }
  await deliverProjectNotification(dependencies, {
    projectId,
    requiredCapability: 'project.connect_stripe',
    eventKey: `stripe-restriction:${requiredId(payload, 'event_id')}`,
    template: 'stripe-restriction',
    metadata: { notification: 'stripe-restriction', project_id: projectId },
    render: (projectName, locale) =>
      renderStripeRestrictionEmail({ projectName, restriction, locale }),
  });
}

async function domainFailure(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const domainId = requiredId(payload, 'domain_id');
  const eventId = requiredId(payload, 'event_id');
  const failure = payload.failure;
  if (typeof failure !== 'string' || failure.length === 0 || failure.length > 200) {
    throw new Error('Email notification payload failure is invalid');
  }
  const domain = await dependencies.db
    .selectFrom('custom_domain')
    .select(['id', 'hostname'])
    .where('id', '=', domainId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
  if (!domain) return;
  await deliverProjectNotification(dependencies, {
    projectId,
    requiredCapability: 'project.manage_domain',
    eventKey: `domain-failure:${domainId}:${eventId}`,
    template: 'domain-failure',
    metadata: {
      notification: 'domain-failure',
      project_id: projectId,
      domain_id: domainId,
      event_id: eventId,
    },
    render: (projectName, locale) =>
      renderDomainFailureEmail({ projectName, domain: domain.hostname, failure, locale }),
  });
}

async function membership(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const subscriptionId = requiredId(payload, 'subscription_id');
  const eventId = requiredId(payload, 'event_id');
  const event = requiredValue<MembershipEmailEvent>(payload, 'event', [
    'started',
    'renewed',
    'cancelled',
    'payment_failed',
    'grace_ending',
  ]);
  const row = await dependencies.db
    .selectFrom('subscription')
    .innerJoin('project', 'project.id', 'subscription.project_id')
    .innerJoin('tier', 'tier.id', 'subscription.tier_id')
    .innerJoin('user', 'user.id', 'subscription.user_id')
    .select([
      'subscription.id',
      'subscription.project_id',
      'subscription.user_id',
      'subscription.project_amount_minor',
      'subscription.platform_tip_minor',
      'subscription.currency',
      'subscription.feature_mode',
      'subscription.cadence',
      'project.name as project_name',
      'tier.name as tier_name',
      'user.email',
      'user.locale',
    ])
    .where('subscription.id', '=', subscriptionId)
    .executeTakeFirst();
  if (
    !row ||
    !row.user_id ||
    !row.email ||
    !row.project_amount_minor ||
    !row.currency ||
    !row.feature_mode ||
    !row.cadence
  ) {
    return;
  }
  const currency = row.currency;
  const userId = row.user_id;
  const email = row.email;
  const localePreference = row.locale ?? 'en-GB';
  const featureMode = row.feature_mode === 'contributes_5_percent' ? row.feature_mode : 'standard';
  const cadence = row.cadence === 'annual' ? row.cadence : 'monthly';
  const allocation = computeFeeAllocation({
    projectAmountMinor: BigInt(String(row.project_amount_minor)),
    platformTipMinor: BigInt(String(row.platform_tip_minor ?? 0)),
    currency,
    featureMode,
    cadence,
  });
  const recipient: Recipient = { userId, email, locale: localePreference };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:membership:${eventId}:${recipientKey(recipient)}`,
    template: 'membership',
    metadata: {
      notification: 'membership',
      subscription_id: subscriptionId,
      event_id: eventId,
      event,
    },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderMembershipEmail({
        event,
        projectName: row.project_name,
        projectAmount: formatMoney(allocation.projectAmount, locale),
        currency,
        platformFees: formatMoney(allocation.ossProjectFee, locale),
        ...(dependencies.publicAppUrl
          ? { manageUrl: publicUrl(dependencies, '/me/memberships') }
          : {}),
        locale,
      }),
  });
}

async function refund(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const refundId = requiredId(payload, 'refund_id');
  const eventId = requiredId(payload, 'event_id');
  const row = await dependencies.db
    .selectFrom('refund')
    .innerJoin('payment', 'payment.id', 'refund.payment_id')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .leftJoin('user', 'user.id', 'payment.user_id')
    .select([
      'refund.id',
      'refund.amount_minor',
      'refund.application_fee_refund_minor',
      'refund.currency',
      'refund.reason',
      'refund.status',
      'payment.user_id',
      'payment.receipt_email',
      'payment.oss_project_fee_minor',
      'project.name as project_name',
      'user.email as user_email',
      'user.locale as user_locale',
    ])
    .where('refund.id', '=', refundId)
    .executeTakeFirst();
  if (!row || row.status !== 'succeeded') return;
  const email = row.user_email ?? row.receipt_email;
  if (!email) return;
  const recipient: Recipient = {
    ...(row.user_id ? { userId: row.user_id } : {}),
    email,
    locale: row.user_locale ?? 'en-GB',
  };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:refund:${refundId}:${recipientKey(recipient)}`,
    template: 'refund',
    metadata: { notification: 'refund', refund_id: refundId, event_id: eventId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderRefundEmail({
        projectName: row.project_name,
        refundAmount: formatMoney(money(row.amount_minor, row.currency), locale),
        currency: row.currency,
        platformFeesRefunded: formatMoney(
          money(row.application_fee_refund_minor, row.currency),
          locale,
        ),
        ...(row.reason ? { reason: row.reason } : {}),
        locale,
      }),
  });
}

async function dispute(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const disputeId = requiredId(payload, 'dispute_id');
  const eventId = requiredId(payload, 'event_id');
  const row = await dependencies.db
    .selectFrom('payment_dispute')
    .innerJoin('payment', 'payment.id', 'payment_dispute.payment_id')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .leftJoin('user', 'user.id', 'payment.user_id')
    .select([
      'payment_dispute.id',
      'payment_dispute.status',
      'payment_dispute.amount_minor',
      'payment_dispute.currency',
      'payment.user_id',
      'payment.receipt_email',
      'project.name as project_name',
      'user.email as user_email',
      'user.locale as user_locale',
    ])
    .where('payment_dispute.id', '=', disputeId)
    .executeTakeFirst();
  if (!row) return;
  const email = row.user_email ?? row.receipt_email;
  if (!email) return;
  const recipient: Recipient = {
    ...(row.user_id ? { userId: row.user_id } : {}),
    email,
    locale: row.user_locale ?? 'en-GB',
  };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:dispute:${eventId}:${row.status}:${recipientKey(recipient)}`,
    template: 'dispute',
    metadata: {
      notification: 'dispute',
      dispute_id: disputeId,
      event_id: eventId,
      status: row.status,
    },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderDisputeEmail({
        projectName: row.project_name,
        disputeStatus: row.status,
        amount: formatMoney(money(row.amount_minor, row.currency), locale),
        currency: row.currency,
        locale,
      }),
  });
}

async function securityChange(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const userId = requiredId(payload, 'user_id');
  const eventId = requiredId(payload, 'event_id');
  const action = requiredValue<SecurityChangeAction>(payload, 'action', SECURITY_CHANGE_ACTIONS);
  const user = await dependencies.db
    .selectFrom('user')
    .select(['id', 'email', 'locale'])
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user) return;
  const recipient: Recipient = { userId: user.id, email: user.email, locale: user.locale };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:security:${eventId}:${recipientKey(recipient)}`,
    template: 'security-change',
    metadata: { notification: 'security-change', user_id: userId, event_id: eventId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderSecurityChangeEmail({
        projectName: 'oss.tips',
        change: securityChangeLabel(action, locale),
        locale,
      }),
  });
}

async function securityEvent(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const userId = requiredId(payload, 'user_id');
  const eventId = requiredId(payload, 'event_id');
  const event = requiredValue(payload, 'event', ['sign-in'] as const);
  const row = await dependencies.db
    .selectFrom('user_security_event')
    .innerJoin('user', 'user.id', 'user_security_event.user_id')
    .select([
      'user_security_event.id',
      'user_security_event.user_id',
      'user_security_event.ip_address',
      'user_security_event.user_agent',
      'user.email',
      'user.locale',
    ])
    .where('user_security_event.id', '=', eventId)
    .where('user_security_event.user_id', '=', userId)
    .executeTakeFirst();
  if (!row || !row.user_id) return;
  const recipient: Recipient = { userId: row.user_id, email: row.email, locale: row.locale };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:security-event:${eventId}:${recipientKey(recipient)}`,
    template: 'security-event',
    metadata: { notification: 'security-event', user_id: userId, event_id: eventId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderSecurityEventEmail({
        event,
        ...(row.ip_address ? { ip: row.ip_address } : {}),
        ...(row.user_agent ? { userAgent: row.user_agent } : {}),
        locale,
      }),
  });
}

async function teamInvite(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const inviteId = requiredId(payload, 'invite_id');
  const invite = await dependencies.db
    .selectFrom('project_team_invite')
    .innerJoin('project', 'project.id', 'project_team_invite.project_id')
    .leftJoin('user', 'user.email', 'project_team_invite.email')
    .select([
      'project_team_invite.id',
      'project_team_invite.email',
      'project_team_invite.role',
      'project_team_invite.status',
      'project_team_invite.expires_at',
      'project.name as project_name',
      'user.locale as recipient_locale',
    ])
    .where('project_team_invite.id', '=', inviteId)
    .where('project_team_invite.project_id', '=', projectId)
    .executeTakeFirst();
  const now = dependencies.now?.() ?? new Date();
  if (!invite || invite.status !== 'pending' || invite.expires_at <= now) return;
  await deliverEmail(dependencies, {
    recipient: { email: invite.email, locale: invite.recipient_locale },
    dedupeKey: `email:team-invite:${inviteId}:${recipientKey({ email: invite.email })}`,
    template: 'team-invite',
    metadata: { notification: 'team-invite', project_id: projectId, invite_id: inviteId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) =>
      renderTeamInviteEmail({
        projectName: invite.project_name,
        role: invite.role,
        inviteUrl: publicUrl(dependencies, `/invite/${encodeURIComponent(invite.id)}`),
        expiresAt: invite.expires_at.toISOString(),
        locale,
      }),
  });
}

async function guestReceipt(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const paymentId = requiredId(payload, 'payment_id');
  const eventId = requiredId(payload, 'event_id');
  const payment = await dependencies.db
    .selectFrom('payment')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .leftJoin('user', 'user.email', 'payment.receipt_email')
    .select([
      'payment.id',
      'payment.user_id',
      'payment.receipt_email',
      'payment.cadence',
      'payment.status',
      'payment.project_amount_minor',
      'payment.oss_project_fee_minor',
      'payment.currency',
      'project.name as project_name',
      'user.locale as recipient_locale',
    ])
    .where('payment.id', '=', paymentId)
    .executeTakeFirst();
  if (
    !payment ||
    payment.user_id ||
    payment.status !== 'succeeded' ||
    payment.cadence !== 'one_off' ||
    !payment.receipt_email
  ) {
    return;
  }
  const recipient: Recipient = { email: payment.receipt_email, locale: payment.recipient_locale };
  const guestToken = await ensureStableGuestToken(dependencies, {
    kind: 'claim',
    resourceId: paymentId,
    paymentId,
    email: payment.receipt_email,
  });
  if (!guestToken) return;
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:guest-receipt:${eventId}:${recipientKey(recipient)}`,
    template: 'receipt',
    metadata: { notification: 'guest-receipt', payment_id: paymentId, event_id: eventId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    ...(guestToken.used ? { retryUsedToken: true } : {}),
    render: (locale) =>
      renderReceiptEmail({
        projectName: payment.project_name,
        projectAmount: formatMoney(money(payment.project_amount_minor, payment.currency), locale),
        currency: payment.currency,
        platformFees: formatMoney(money(payment.oss_project_fee_minor, payment.currency), locale),
        receiptUrl: publicUrl(dependencies, `/claim/${guestToken.token}`),
        locale,
      }),
  });
}

async function guestReply(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const threadId = requiredId(payload, 'thread_id');
  const messageId = requiredId(payload, 'message_id');
  const message = await dependencies.db
    .selectFrom('supporter_message as message')
    .innerJoin('supporter_message_thread as thread', 'thread.id', 'message.thread_id')
    .innerJoin('payment', 'payment.id', 'thread.payment_id')
    .innerJoin('project', 'project.id', 'thread.project_id')
    .leftJoin('user', 'user.email', 'payment.receipt_email')
    .select([
      'message.id',
      'message.body',
      'message.author_user_id',
      'thread.id as thread_id',
      'thread.project_id',
      'thread.supporter_user_id',
      'payment.status as payment_status',
      'payment.receipt_email',
      'project.name as project_name',
      'user.locale as recipient_locale',
    ])
    .where('message.id', '=', messageId)
    .where('message.thread_id', '=', threadId)
    .where('thread.project_id', '=', projectId)
    .executeTakeFirst();
  if (
    !message ||
    !message.author_user_id ||
    message.supporter_user_id ||
    message.payment_status !== 'succeeded' ||
    !message.receipt_email
  ) {
    return;
  }
  const recipient: Recipient = { email: message.receipt_email, locale: message.recipient_locale };
  const guestToken = await ensureStableGuestToken(dependencies, {
    kind: 'reply',
    resourceId: messageId,
    threadId,
    email: message.receipt_email,
  });
  if (!guestToken) return;
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:guest-reply:${messageId}:${recipientKey(recipient)}`,
    template: 'thank-you-reply',
    metadata: {
      notification: 'guest-reply',
      project_id: projectId,
      thread_id: threadId,
      message_id: messageId,
    },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    ...(guestToken.used ? { retryUsedToken: true } : {}),
    render: (locale) =>
      renderThankYouReplyEmail({
        projectName: message.project_name,
        messagePreview: message.body,
        threadUrl: publicUrl(dependencies, `/reply/${guestToken.token}`),
        locale,
      }),
  });
}

async function supportEmailVerification(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const projectId = requiredId(payload, 'project_id');
  const verificationId = requiredId(payload, 'verification_id');
  const secret = dependencies.authSecret?.trim();
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for support email verification');
  const [verification, project] = await Promise.all([
    dependencies.db
      .selectFrom('verification')
      .select(['id', 'identifier', 'value', 'expires_at'])
      .where('id', '=', verificationId)
      .executeTakeFirst(),
    dependencies.db
      .selectFrom('project')
      .select(['id', 'support_email'])
      .where('id', '=', projectId)
      .executeTakeFirst(),
  ]);
  if (!verification || !project?.support_email) return;
  const expectedIdentifier = supportEmailIdentifier(projectId, project.support_email, secret);
  if (verification.identifier !== expectedIdentifier) return;
  const now = dependencies.now?.() ?? new Date();
  if (verification.expires_at <= now) return;
  const code = supportEmailCodeFromVerificationValue(
    verification.identifier,
    verification.value,
    secret,
  );
  if (!code) return;
  const recipientRow = await dependencies.db
    .selectFrom('user')
    .select('locale')
    .where('email', '=', project.support_email)
    .executeTakeFirst();
  const recipient: Recipient = {
    email: project.support_email,
    ...(recipientRow?.locale ? { locale: recipientRow.locale } : {}),
  };
  const normalizedEmail = normalizeEmailAddress(project.support_email);
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:support-email-verification:${verificationId}:${recipientKey(recipient)}`,
    template: 'otp',
    metadata: {
      notification: 'support-email-verification',
      project_id: projectId,
      verification_id: verificationId,
    },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    validate: async (db) => {
      const [currentVerification, currentProject] = await Promise.all([
        db
          .selectFrom('verification')
          .select(['id', 'value', 'expires_at'])
          .where('id', '=', verificationId)
          .executeTakeFirst(),
        db
          .selectFrom('project')
          .select(['support_email', 'support_email_verified_at'])
          .where('id', '=', projectId)
          .executeTakeFirst(),
      ]);
      const now = dependencies.now?.() ?? new Date();
      return Boolean(
        currentVerification &&
        currentVerification.id === verification.id &&
        currentVerification.value === verification.value &&
        currentVerification.expires_at > now &&
        currentProject?.support_email &&
        normalizeEmailAddress(currentProject.support_email) === normalizedEmail &&
        !currentProject.support_email_verified_at,
      );
    },
    render: (locale) =>
      renderOtpEmail({ code, expiresMinutes: 10, purpose: 'support-email', locale }),
  });
}

async function authOtp(
  dependencies: EmailNotificationDependencies,
  payload: EmailNotificationPayload,
): Promise<void> {
  const verificationId = requiredId(payload, 'verification_id');
  const secret = dependencies.authSecret?.trim();
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for auth OTP delivery');

  const requested = await dependencies.db
    .selectFrom('verification')
    .select(['id', 'identifier'])
    .where('id', '=', verificationId)
    .executeTakeFirst();
  if (!requested) return;
  const email = signInOtpEmail(requested.identifier);
  if (!email) return;

  const now = dependencies.now?.() ?? new Date();
  const latest = await dependencies.db
    .selectFrom('verification')
    .select(['id', 'value', 'expires_at'])
    .where('identifier', '=', requested.identifier)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .executeTakeFirst();
  if (!latest || latest.id !== requested.id || latest.expires_at <= now) return;

  const parsed = parseAuthOtpValue(latest.value);
  if (!parsed || parsed.attempts !== 0 || !isAuthOtpHash(parsed.hash)) return;
  const code = recoverAuthOtp(latest.value, secret);
  if (!code) return;

  const user = await dependencies.db
    .selectFrom('user')
    .select(['id', 'email', 'locale'])
    .where('email', '=', email)
    .executeTakeFirst();

  const expiresMinutes = Math.max(
    1,
    Math.ceil((latest.expires_at.getTime() - now.getTime()) / 60_000),
  );
  const recipient: Recipient = user
    ? { userId: user.id, email: user.email, locale: user.locale }
    : { email };
  await deliverEmail(dependencies, {
    recipient,
    dedupeKey: `email:auth-otp:${verificationId}:${recipientKey(recipient)}`,
    template: 'otp',
    metadata: { notification: 'auth-otp', verification_id: verificationId },
    ...(dependencies.jobId ? { jobId: dependencies.jobId } : {}),
    render: (locale) => renderOtpEmail({ code, expiresMinutes, locale }),
  });
}

export async function sendEmailNotificationJob(
  dependencies: EmailNotificationDependencies,
  job: Job,
): Promise<void> {
  const payload = payloadOf(job);
  const deliveryDependencies: EmailNotificationDependencies = {
    ...dependencies,
    jobId: job.id,
  };
  switch (payload.notification) {
    case 'project-review':
      return projectReview(deliveryDependencies, payload);
    case 'api-key-change':
      return apiKeyChange(deliveryDependencies, payload);
    case 'webhook-change':
      return webhookChange(deliveryDependencies, payload);
    case 'stripe-restriction':
      return stripeRestriction(deliveryDependencies, payload);
    case 'domain-failure':
      return domainFailure(deliveryDependencies, payload);
    case 'membership':
      return membership(deliveryDependencies, payload);
    case 'refund':
      return refund(deliveryDependencies, payload);
    case 'dispute':
      return dispute(deliveryDependencies, payload);
    case 'security-change':
      return securityChange(deliveryDependencies, payload);
    case 'security-event':
      return securityEvent(deliveryDependencies, payload);
    case 'team-invite':
      return teamInvite(deliveryDependencies, payload);
    case 'guest-receipt':
      return guestReceipt(deliveryDependencies, payload);
    case 'guest-reply':
      return guestReply(deliveryDependencies, payload);
    case 'support-email-verification':
      return supportEmailVerification(deliveryDependencies, payload);
    case 'auth-otp':
      return authOtp(deliveryDependencies, payload);
    default:
      throw new Error(`Unsupported email notification: ${payload.notification}`);
  }
}
