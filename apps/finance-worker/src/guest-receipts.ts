import { emailNotificationJob, type Db } from '@oss-tips/db';

type JobWriter = Pick<Db, 'insertInto'>;

export type GuestReceiptNotificationPayload = {
  notification: 'guest-receipt';
  payment_id: string;
  event_id: string;
};

export function guestReceiptNotificationPayload(
  paymentId: string,
  eventId: string,
): GuestReceiptNotificationPayload {
  return {
    notification: 'guest-receipt',
    payment_id: paymentId,
    event_id: eventId,
  };
}

/** Enqueue receipt delivery on the caller's transaction. */
export async function enqueueGuestReceiptJob(args: {
  db: JobWriter;
  paymentId: string;
  eventId: string;
}): Promise<void> {
  await args.db
    .insertInto('job')
    .values(emailNotificationJob(guestReceiptNotificationPayload(args.paymentId, args.eventId)))
    .execute();
}
