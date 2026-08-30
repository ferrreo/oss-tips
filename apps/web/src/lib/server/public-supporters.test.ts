import { describe, expect, it } from 'vitest';
import { visiblePublicSupportPayments } from './public-supporters';

const base = {
  user_id: 'user-1',
  currency: 'gbp',
  cadence: 'one_off',
  project_amount_minor: 1000,
  created_at: new Date('2026-08-02T00:00:00.000Z'),
  settled_at: new Date('2026-08-02T00:00:00.000Z'),
};

describe('public supporter payment visibility', () => {
  it('uses settled net amounts and keeps currencies separate', () => {
    const rows = [
      { ...base, id: 'partial', status: 'succeeded' },
      { ...base, id: 'full', status: 'refunded' },
      { ...base, id: 'open', status: 'succeeded' },
      { ...base, id: 'lost', status: 'disputed' },
      { ...base, id: 'won', status: 'disputed' },
      { ...base, id: 'usd', currency: 'usd', status: 'succeeded' },
      { ...base, id: 'pending', status: 'pending', settled_at: null },
    ];
    const visible = visiblePublicSupportPayments(rows, {
      refunds: [
        {
          payment_id: 'partial',
          amount_minor: 100,
          application_fee_refund_minor: 0,
          status: 'succeeded',
        },
        {
          payment_id: 'full',
          amount_minor: 1100,
          application_fee_refund_minor: 120,
          status: 'succeeded',
        },
      ],
      disputes: [
        { payment_id: 'open', amount_minor: 200, status: 'open' },
        { payment_id: 'lost', amount_minor: 100, status: 'lost' },
        { payment_id: 'won', amount_minor: 100, status: 'won' },
      ],
    });

    expect(visible.map(({ row, amountMinor }) => [row.id, row.currency, amountMinor])).toEqual([
      ['partial', 'gbp', 900n],
      ['open', 'gbp', 800n],
      ['lost', 'gbp', 900n],
      ['won', 'gbp', 1000n],
      ['usd', 'usd', 1000n],
    ]);
  });
});
