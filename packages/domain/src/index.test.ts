import { describe, expect, it } from 'vitest';
import {
  computeFeeAllocation,
  proportionalPlatformRefund,
  reduceMembership,
  hasActiveAccess,
  canViewContent,
  computeGoalProgress,
  validateProjectSlug,
  signWebhookPayload,
  verifyWebhookSignature,
  canProject,
  feeRateBps,
} from './index.js';

describe('fees', () => {
  it('computes standard one-off with tip and zero project fee', () => {
    const a = computeFeeAllocation({
      projectAmountMinor: 1000,
      platformTipMinor: 100,
      currency: 'gbp',
      featureMode: 'standard',
      cadence: 'one_off',
    });
    expect(a.ossProjectFee.amountMinor).toBe(0n);
    expect(a.stripeApplicationFee.amountMinor).toBe(100n);
    expect(a.customerCharge.amountMinor).toBe(1100n);
    expect(a.projectBeforeStripe.amountMinor).toBe(1000n);
  });

  it('computes 5% mode one-off', () => {
    const a = computeFeeAllocation({
      projectAmountMinor: 1000,
      platformTipMinor: 100,
      currency: 'gbp',
      featureMode: 'contributes_5_percent',
      cadence: 'one_off',
    });
    expect(a.ossProjectFee.amountMinor).toBe(50n);
    expect(a.stripeApplicationFee.amountMinor).toBe(150n);
    expect(a.projectBeforeStripe.amountMinor).toBe(950n);
  });

  it('uses 2% for standard monthly', () => {
    expect(feeRateBps('standard', 'monthly')).toBe(200);
    const a = computeFeeAllocation({
      projectAmountMinor: 1000,
      platformTipMinor: 0,
      currency: 'gbp',
      featureMode: 'standard',
      cadence: 'monthly',
    });
    expect(a.ossProjectFee.amountMinor).toBe(20n);
  });

  it('refunds application fee proportionally', () => {
    expect(
      proportionalPlatformRefund({
        originalCustomerChargeMinor: 1100n,
        refundCustomerChargeMinor: 550n,
        originalApplicationFeeMinor: 150n,
      }),
    ).toBe(75n);
  });
});

describe('membership', () => {
  it('enters grace on failed invoice and retains access', () => {
    let s = reduceMembership(
      { status: 'incomplete', currentPeriodEnd: null, graceEndsAt: null, cancelAtPeriodEnd: false },
      { kind: 'invoice_paid', periodEnd: new Date('2030-01-01') },
    );
    expect(s.status).toBe('active');
    s = reduceMembership(s, { kind: 'invoice_failed', at: new Date('2026-01-01') });
    expect(s.status).toBe('grace');
    expect(hasActiveAccess(s, new Date('2026-01-02'))).toBe(true);
  });
});

describe('entitlements visibility', () => {
  it('gates minimum tier', () => {
    const ok = canViewContent({
      rule: { kind: 'minimum_tier_rank', rank: 2 },
      signedIn: true,
      activeEntitlements: [
        {
          kind: 'membership',
          tierRank: 2,
          tierId: 't1',
          startsAt: new Date(0),
          endsAt: null,
          revokedAt: null,
        },
      ],
    });
    expect(ok).toBe(true);
  });
});

describe('goals', () => {
  it('computes money progress', () => {
    const p = computeGoalProgress({
      type: 'one_time_money',
      targetMinor: 10000n,
      targetCount: null,
      settledProjectSupportMinor: 6000n,
      activeSupporterCount: 0,
      mrrMinor: 0n,
    });
    expect(p.percent).toBe(60);
    expect(p.complete).toBe(false);
  });
});

describe('slug + webhooks + permissions', () => {
  it('rejects reserved slugs', () => {
    expect(validateProjectSlug('admin').ok).toBe(false);
    expect(validateProjectSlug('rust').ok).toBe(true);
  });

  it('signs and verifies webhooks', () => {
    const raw = '{"ok":true}';
    const ts = 1787947200;
    const sig = signWebhookPayload({ secret: 'test-secret', timestamp: ts, rawBody: raw });
    expect(
      verifyWebhookSignature({
        secret: 'test-secret',
        timestampHeader: String(ts),
        signatureHeader: sig,
        rawBody: raw,
        nowSeconds: ts,
      }),
    ).toBe(true);
  });

  it('allows owner refund', () => {
    const actor = {
      kind: 'user' as const,
      userId: 'u1',
      projectRoles: new Map([['p1', 'owner' as const]]),
      platformRoles: [],
    };
    expect(canProject(actor, 'project.refund', 'p1').allowed).toBe(true);
    expect(canProject(actor, 'project.refund', 'p2').allowed).toBe(false);
  });
});
