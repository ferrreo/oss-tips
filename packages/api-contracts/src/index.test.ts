import { describe, expect, it } from 'vitest';
import {
  CheckoutIntentRequestSchema,
  CheckoutIntentResponseSchema,
  WebhookEnvelopeSchema,
  ProblemDetailsSchema,
  MoneySchema,
  SupportedCurrencySchema,
  ProjectListResponseSchema,
  ProjectTierCreateSchema,
  ProjectGoalCreateSchema,
  ProjectTeamInviteCreateSchema,
  ProjectPublishSchema,
  ProjectCreateSchema,
  ProjectSettingsPatchSchema,
  ProjectSupportEmailVerificationRequestSchema,
  ProjectOwnershipReviewDecisionSchema,
  AccountPreferencesSchema,
  AccountPreferencesPatchSchema,
  MembershipPatchSchema,
  MembershipSchema,
  PublicAnalyticsEventSchema,
  generateOpenApiDocument,
} from './index.js';
import {
  apiKeyPrefix,
  createApiKeySecret,
  createWebhookSecret,
  decryptWebhookSecret,
  encryptWebhookSecret,
  hashApiKeySecret,
  hashForEtag,
  verifyApiKeySecret,
} from './security.js';
import { checkWebhookDestination, isBlockedIp } from './webhook-destination.js';
import { WEBHOOK_API_VERSION } from '@oss-tips/domain';

describe('money schema', () => {
  it('accepts string minor amounts', () => {
    expect(MoneySchema.parse({ amount: '1000', currency: 'gbp' })).toEqual({
      amount: '1000',
      currency: 'gbp',
    });
  });

  it('accepts only currencies backed by settlement ledger', () => {
    for (const currency of ['gbp', 'usd', 'eur', 'jpy']) {
      expect(SupportedCurrencySchema.safeParse(currency).success).toBe(true);
    }
    expect(SupportedCurrencySchema.safeParse('cad').success).toBe(false);
  });
});

describe('account preferences schemas', () => {
  it('keeps theme and locale values bounded', () => {
    expect(AccountPreferencesSchema.parse({ theme: 'dark', locale: 'de' })).toEqual({
      theme: 'dark',
      locale: 'de',
    });
    expect(AccountPreferencesPatchSchema.safeParse({}).success).toBe(false);
    expect(AccountPreferencesPatchSchema.safeParse({ locale: 'en-US' }).success).toBe(false);
  });
});

describe('membership tip schemas', () => {
  it('accepts zero tips and rejects empty or negative changes', () => {
    expect(MembershipPatchSchema.parse({ platform_tip: { amount: '0', currency: 'gbp' } })).toEqual(
      { platform_tip: { amount: '0', currency: 'gbp' } },
    );
    expect(MembershipPatchSchema.safeParse({}).success).toBe(false);
    expect(
      MembershipPatchSchema.safeParse({ platform_tip: { amount: '-1', currency: 'gbp' } }).success,
    ).toBe(false);
    expect(
      MembershipSchema.parse({
        id: 'membership-1',
        project_id: 'project-1',
        tier_id: 'tier-1',
        status: 'active',
        current_period_end: null,
        cancel_at_period_end: false,
        platform_tip: { amount: '0', currency: 'gbp' },
      }).platform_tip,
    ).toEqual({ amount: '0', currency: 'gbp' });
  });
});

describe('checkout intent schemas', () => {
  it('parses request matching docs example', () => {
    const parsed = CheckoutIntentRequestSchema.parse({
      projectAmountMinor: 1000,
      projectCurrency: 'gbp',
      platformTipMinor: 100,
      cadence: 'one_off',
      publicOptions: { showName: true, showAmount: false, showMessage: true },
    });
    expect(parsed.projectAmountMinor).toBe(1000);
  });

  it('rejects unsupported currency before checkout', () => {
    expect(
      CheckoutIntentRequestSchema.safeParse({
        projectAmountMinor: 1000,
        projectCurrency: 'cad',
        platformTipMinor: 0,
        cadence: 'one_off',
        publicOptions: { showName: false, showAmount: false, showMessage: false },
      }).success,
    ).toBe(false);
  });

  it('rejects client-supplied fee fields and unsafe numeric values', () => {
    expect(
      CheckoutIntentRequestSchema.safeParse({
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 100,
        applicationFeeMinor: 1,
        cadence: 'one_off',
        publicOptions: { showName: true, showAmount: false, showMessage: true },
      }).success,
    ).toBe(false);
    expect(
      CheckoutIntentRequestSchema.safeParse({
        projectAmountMinor: Number.MAX_SAFE_INTEGER + 1,
        projectCurrency: 'gbp',
        platformTipMinor: 0,
        cadence: 'one_off',
        publicOptions: { showName: true, showAmount: false, showMessage: true },
      }).success,
    ).toBe(false);
  });

  it('bounds optional public recognition text', () => {
    const parsed = CheckoutIntentRequestSchema.parse({
      projectAmountMinor: 1000,
      projectCurrency: 'gbp',
      platformTipMinor: 100,
      cadence: 'one_off',
      receiptEmail: 'ada@example.com',
      publicOptions: {
        showName: true,
        showAmount: false,
        showMessage: true,
        displayName: 'Ada Lovelace',
        message: 'Thanks for maintaining this project.',
      },
    });
    expect(parsed.publicOptions.displayName).toBe('Ada Lovelace');
    expect(parsed.receiptEmail).toBe('ada@example.com');
    expect(
      CheckoutIntentRequestSchema.safeParse({
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 100,
        cadence: 'one_off',
        publicOptions: {
          showName: true,
          showAmount: false,
          showMessage: true,
          message: 'x'.repeat(2001),
        },
      }).success,
    ).toBe(false);
    expect(
      CheckoutIntentRequestSchema.safeParse({
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 100,
        cadence: 'one_off',
        receiptEmail: 'not-an-email',
        publicOptions: { showName: false, showAmount: false, showMessage: false },
      }).success,
    ).toBe(false);
  });

  it('parses checkout response', () => {
    const parsed = CheckoutIntentResponseSchema.parse({
      id: 'ci_abc',
      client_secret: 'cs_secret',
      checkout_url: 'https://checkout.stripe.com/c/pay/cs_test',
      expires_at: '2026-08-28T20:30:00Z',
      application_fee: { amount: '100', currency: 'gbp' },
      customer_charge: { amount: '1100', currency: 'gbp' },
      mode: 'payment',
    });
    expect(parsed.mode).toBe('payment');
  });
});

describe('webhook envelope', () => {
  it('validates outgoing event envelope', () => {
    const envelope = WebhookEnvelopeSchema.parse({
      id: 'evt_01J',
      type: 'membership.renewed',
      api_version: WEBHOOK_API_VERSION,
      created_at: '2026-08-28T20:00:00Z',
      project_id: 'prj_01J',
      data: { object: { membership_id: 'm1' } },
    });
    expect(envelope.type).toBe('membership.renewed');
  });
});

describe('public analytics events', () => {
  it('keeps conversion events server-owned', () => {
    expect(PublicAnalyticsEventSchema.safeParse({ event: 'page_view' }).success).toBe(true);
    expect(
      PublicAnalyticsEventSchema.safeParse({ event: 'page_view', referrer: 'https://github.com' })
        .success,
    ).toBe(true);
    expect(
      PublicAnalyticsEventSchema.safeParse({ event: 'page_view', country: 'GB' }).success,
    ).toBe(false);
    expect(
      PublicAnalyticsEventSchema.safeParse({
        event: 'confirmed_conversion',
        payment_id: 'payment-1',
      }).success,
    ).toBe(false);
  });
});

describe('problem details', () => {
  it('parses RFC 9457 shape', () => {
    const p = ProblemDetailsSchema.parse({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Project not found',
    });
    expect(p.status).toBe(404);
  });
});

describe('openapi', () => {
  it('generates OpenAPI 3.1 document with checkout path', () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths?.['/api/v1/projects/{slug}/checkout-intents']).toBeDefined();
    const checkoutPost = doc.paths?.['/api/v1/projects/{slug}/checkout-intents']?.post;
    expect(checkoutPost?.responses?.['429']).toMatchObject({
      headers: {
        'Retry-After': expect.anything(),
        'RateLimit-Limit': expect.anything(),
        'RateLimit-Remaining': expect.anything(),
        'RateLimit-Reset': expect.anything(),
      },
    });
    for (const path of [
      '/api/v1/projects',
      '/api/v1/projects/{slug}',
      '/api/v1/projects/{slug}/tiers',
      '/api/v1/projects/{slug}/goals',
      '/api/v1/projects/{slug}/posts',
      '/api/v1/projects/{slug}/posts/{postSlug}',
      '/api/v1/projects/{slug}/supporters',
      '/api/v1/me',
      '/api/v1/me/preferences',
      '/api/v1/me/support',
      '/api/v1/me/memberships',
      '/api/v1/me/entitlements',
      '/api/v1/me/inbox',
      '/api/v1/project',
      '/api/v1/project/tiers',
      '/api/v1/project/posts',
      '/api/v1/project/goals',
      '/api/v1/project/supporters',
      '/api/v1/project/analytics',
      '/api/v1/project/webhooks',
      '/api/v1/project/webhooks/{id}',
      '/api/v1/project/webhooks/{id}/replay',
      '/api/v1/project/api-keys',
      '/api/v1/project/api-keys/{id}',
      '/api/v1/project/domains',
      '/api/v1/project/ownership',
      '/api/v1/project/publish',
      '/api/v1/project/team',
      '/api/v1/project/team/{id}',
      '/api/v1/project/team/invites/{id}/accept',
      '/api/v1/project/tiers/{id}',
      '/api/v1/project/goals/{id}',
      '/api/v1/project/goals/{id}/publish',
      '/api/v1/project/support-email/verification',
      '/api/v1/admin/project-claims',
      '/api/v1/admin/project-claims/{id}',
    ]) {
      expect(doc.paths?.[path]).toBeDefined();
    }
  });
});

describe('project management schemas', () => {
  it('requires onboarding identity and an explicit open-source declaration', () => {
    const project = ProjectCreateSchema.parse({
      name: 'Ledger Kit',
      slug: 'ledger-kit',
      description: 'A small accounting library.',
      website_url: 'https://ledger-kit.dev',
      support_email: 'maintainers@ledger-kit.dev',
      repository_url: 'https://github.com/acme/ledger-kit.git',
      open_source_declared: true,
    });
    expect(project.default_currency).toBe('gbp');
    expect(ProjectCreateSchema.safeParse({ ...project, open_source_declared: false }).success).toBe(
      false,
    );
    expect(
      ProjectSupportEmailVerificationRequestSchema.safeParse({ action: 'confirm', code: '12345' })
        .success,
    ).toBe(false);
    expect(
      ProjectOwnershipReviewDecisionSchema.safeParse({ decision: 'approve', reason: '' }).success,
    ).toBe(false);
  });

  it('rejects unsupported project currencies while retaining supported ones', () => {
    const base = {
      name: 'Ledger Kit',
      slug: 'ledger-kit',
      description: 'A small accounting library.',
      website_url: 'https://ledger-kit.dev',
      support_email: 'maintainers@ledger-kit.dev',
      repository_url: 'https://github.com/acme/ledger-kit.git',
      open_source_declared: true,
    };
    expect(ProjectCreateSchema.safeParse({ ...base, default_currency: 'jpy' }).success).toBe(true);
    expect(ProjectCreateSchema.safeParse({ ...base, default_currency: 'cad' }).success).toBe(false);
    expect(ProjectSettingsPatchSchema.safeParse({ default_currency: 'jpy' }).success).toBe(true);
    expect(ProjectSettingsPatchSchema.safeParse({ default_currency: 'cad' }).success).toBe(false);
  });

  it('bounds tiers and keeps goal basis explicit', () => {
    expect(
      ProjectTierCreateSchema.parse({
        name: 'Backer',
        rank: 0,
        monthly_amount: null,
        annual_amount: null,
        one_off_amount: { amount: '200', currency: 'gbp' },
      }).one_off_amount?.amount,
    ).toBe('200');
    expect(
      ProjectTierCreateSchema.safeParse({
        name: 'Too deep',
        rank: 8,
        monthly_amount: null,
        annual_amount: null,
      }).success,
    ).toBe(false);
    expect(
      ProjectGoalCreateSchema.parse({
        title: 'This month',
        goal_type: 'calendar_month_money',
        target_minor: 1000,
      }).status,
    ).toBe('draft');
  });

  it('requires explicit confirmation and valid invitation roles', () => {
    expect(ProjectPublishSchema.safeParse({ confirm: true }).success).toBe(true);
    expect(ProjectPublishSchema.safeParse({ confirm: false }).success).toBe(false);
    expect(
      ProjectTeamInviteCreateSchema.safeParse({ email: 'maintainer@example.com', role: 'owner' })
        .success,
    ).toBe(false);
  });
});

describe('project list pagination', () => {
  it('accepts opaque cursors and rejects legacy timestamp cursors', () => {
    const project = {
      id: 'prj_1',
      slug: 'grove',
      name: 'Grove',
      description: 'A project',
      canonical_url: 'https://oss.tips/grove',
      payment_status: 'active' as const,
      tags: ['github'],
      updated_at: '2026-08-28T20:00:00Z',
    };
    expect(
      ProjectListResponseSchema.parse({ data: [project], next_cursor: 'eyJpZCI6InByal8xIn0' }),
    ).toBeTruthy();
    expect(
      ProjectListResponseSchema.safeParse({
        data: [project],
        next_cursor: '2026-08-28T20:00:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('API and webhook secrets', () => {
  it('hashes API keys without storing the secret and verifies them', () => {
    const secret = createApiKeySecret();
    const encoded = hashApiKeySecret(secret);

    expect(apiKeyPrefix(secret)).toBe(secret.slice(0, 15));
    expect(encoded).not.toContain(secret);
    expect(verifyApiKeySecret(secret, encoded)).toBe(true);
    expect(verifyApiKeySecret(`${secret}x`, encoded)).toBe(false);
  });

  it('encrypts webhook secrets with an envelope key', () => {
    const secret = createWebhookSecret();
    const key = '00'.repeat(32);
    const encrypted = encryptWebhookSecret(secret, key);

    expect(encrypted).not.toContain(secret);
    expect(decryptWebhookSecret(encrypted, key)).toBe(secret);
    expect(() => decryptWebhookSecret(encrypted, '11'.repeat(32))).toThrow();
  });

  it('creates quoted SHA-256 ETags', () => {
    expect(hashForEtag('payload')).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it('rejects private webhook destinations, including IPv6', () => {
    expect(checkWebhookDestination('http://example.com').ok).toBe(false);
    expect(checkWebhookDestination('https://127.0.0.1/hook').ok).toBe(false);
    expect(checkWebhookDestination('https://[::1]/hook').ok).toBe(false);
    expect(checkWebhookDestination('https://example.com/hook').ok).toBe(true);
    expect(isBlockedIp('10.0.0.2')).toBe(true);
    expect(isBlockedIp('2002:7f00:1::1')).toBe(true);
    expect(isBlockedIp('64:ff9b::7f00:1')).toBe(true);
    expect(isBlockedIp('2001:db8::10')).toBe(false);
  });
});
