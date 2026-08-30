import { describe, expect, it } from 'vitest';
import { toGoal, toProjectSummary, toPublicSupporter, toTier } from './public-api.js';

const createdAt = new Date('2026-08-30T12:00:00.000Z');

describe('public supporter projection', () => {
  it('omits every field without its independent opt-in', () => {
    expect(
      toPublicSupporter({
        display_name: 'Ada Lovelace',
        show_name: false,
        show_amount: false,
        show_message: false,
        amount: 1200,
        currency: 'GBP',
        message: 'Keep building.',
        duration: 'days_30',
        created_at: createdAt,
      }),
    ).toEqual({
      display_name: null,
      message: null,
      duration: 'days_30',
      created_at: createdAt.toISOString(),
    });
  });

  it('projects only opted-in identity, amount, and message', () => {
    expect(
      toPublicSupporter({
        display_name: 'Ada Lovelace',
        show_name: true,
        show_amount: true,
        show_message: true,
        amount: '1200',
        currency: 'GBP',
        message: 'Keep building.',
        created_at: createdAt,
      }),
    ).toEqual({
      display_name: 'Ada Lovelace',
      amount: { amount: '1200', currency: 'gbp' },
      message: 'Keep building.',
      created_at: createdAt.toISOString(),
    });
  });

  it('exposes legacy 365-day duration using public year label', () => {
    expect(
      toPublicSupporter({
        display_name: 'Ada Lovelace',
        show_name: true,
        show_amount: false,
        show_message: false,
        duration: 'days_365',
        created_at: createdAt,
      }).duration,
    ).toBe('year');
  });
});

describe('public goal projection', () => {
  it('keeps count targets and progress separate from money', () => {
    expect(
      toGoal(
        {
          id: 'goal-1',
          title: 'Active supporters',
          goal_type: 'active_supporter_count',
          target_minor: null,
          target_count: 12,
          currency: null,
          status: 'published',
          deadline: new Date('2026-12-01T00:00:00.000Z'),
          basis: 'active supporters',
          updated_at: createdAt,
        },
        99900n,
        7,
      ),
    ).toEqual({
      id: 'goal-1',
      title: 'Active supporters',
      type: 'active_supporter_count',
      target: 12,
      progress_percent: (7 / 12) * 100,
      status: 'published',
      deadline: '2026-12-01T00:00:00.000Z',
      basis: 'active supporters',
      updated_at: createdAt.toISOString(),
    });
  });
});

describe('public project payment status', () => {
  const project = {
    id: 'project-1',
    slug: 'grove',
    name: 'Grove',
    description: 'Project description',
    status: 'published',
    default_currency: 'gbp',
    updated_at: createdAt,
  } as const;

  it('reports active only when Stripe account is fully ready', () => {
    expect(
      toProjectSummary(project, 'https://oss.tips', {
        stripe_account_id: 'acct_1',
        charges_enabled: true,
        payouts_enabled: true,
        capabilities: { card_payments: 'active' },
      }).payment_status,
    ).toBe('active');
    expect(
      toProjectSummary(project, 'https://oss.tips', {
        stripe_account_id: 'acct_1',
        charges_enabled: true,
        payouts_enabled: true,
        capabilities: {},
      }).payment_status,
    ).toBe('pending');
    expect(
      toProjectSummary(project, 'https://oss.tips', {
        charges_enabled: true,
        payouts_enabled: true,
        capabilities: { card_payments: 'active' },
      }).payment_status,
    ).toBe('pending');
  });
});

describe('public tier projection', () => {
  it('normalizes canonical 365-day duration to public year value', () => {
    expect(
      toTier({ id: 'tier-1', name: 'Backer', rank: 1, one_off_duration: 'days_365' }, [])
        .one_off_duration,
    ).toBe('year');
  });
});
