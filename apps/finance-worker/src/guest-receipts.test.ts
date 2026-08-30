import { describe, expect, it } from 'vitest';
import type { Db } from '@oss-tips/db';
import { enqueueGuestReceiptJob, guestReceiptNotificationPayload } from './guest-receipts.js';

function fakeJobWriter() {
  const inserted: Record<string, unknown>[] = [];
  const insertBuilder = {
    values: (value: Record<string, unknown>) => {
      inserted.push(value);
      return insertBuilder;
    },
    execute: async () => [],
  };
  const db = { insertInto: () => insertBuilder };
  return { db: db as unknown as Pick<Db, 'insertInto'>, inserted };
}

describe('guest receipt notification', () => {
  it('builds a stable ID-only notification payload', () => {
    expect(guestReceiptNotificationPayload('payment-1', 'evt-1')).toEqual({
      notification: 'guest-receipt',
      payment_id: 'payment-1',
      event_id: 'evt-1',
    });
  });

  it('enqueues on the provided transaction writer without token or provider data', async () => {
    const { db, inserted } = fakeJobWriter();
    await enqueueGuestReceiptJob({ db, paymentId: 'payment-1', eventId: 'evt-1' });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      kind: 'email.notification',
      payload: guestReceiptNotificationPayload('payment-1', 'evt-1'),
    });
    expect(inserted[0]?.payload).not.toHaveProperty('token');
    expect(inserted[0]?.payload).not.toHaveProperty('receipt_email');
    expect(inserted[0]?.payload).not.toHaveProperty('secret');
    expect(inserted[0]?.payload).not.toHaveProperty('provider_error');
  });
});
