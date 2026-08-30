import type { Db } from '@oss-tips/db';

export class TierMemberCapReachedError extends Error {
  constructor() {
    super('Selected tier has reached its member limit');
  }
}

export class CheckoutIdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key already used');
  }
}

export type TierCheckoutReservation = {
  id: string;
  projectId: string;
  userId: string | null;
  currency: string;
  projectAmountMinor: bigint;
  platformTipMinor: bigint;
  tierId: string;
  cadence: 'monthly' | 'annual';
  publicShowName: boolean;
  publicShowAmount: boolean;
  publicShowMessage: boolean;
  expiresAt: Date;
};

export async function withTierCapacity<T>(
  db: Db,
  projectId: string,
  tierId: string | undefined,
  cadence: string,
  reservation: TierCheckoutReservation | undefined,
  operation: (trx: Db) => Promise<T>,
  afterOperation?: (trx: Db, result: T) => Promise<void>,
): Promise<T> {
  if (!tierId || cadence === 'one_off' || !reservation) return operation(db);
  return db.transaction().execute(async (trx) => {
    const tier = await trx
      .selectFrom('tier')
      .select(['member_cap'])
      .where('id', '=', tierId)
      .where('project_id', '=', projectId)
      .where('is_active', '=', true)
      .forUpdate()
      .executeTakeFirst();
    if (!tier || tier.member_cap === null) {
      const result = await operation(trx);
      await afterOperation?.(trx, result);
      return result;
    }

    const existingReservation = await trx
      .selectFrom('checkout_intent')
      .select([
        'project_id',
        'currency',
        'project_amount_minor',
        'platform_tip_minor',
        'tier_id',
        'cadence',
        'public_show_name',
        'public_show_amount',
        'public_show_message',
      ])
      .where('id', '=', reservation.id)
      .executeTakeFirst();
    if (
      existingReservation &&
      (existingReservation.project_id !== reservation.projectId ||
        existingReservation.currency.toLowerCase() !== reservation.currency ||
        String(existingReservation.project_amount_minor) !==
          reservation.projectAmountMinor.toString() ||
        String(existingReservation.platform_tip_minor) !==
          reservation.platformTipMinor.toString() ||
        existingReservation.tier_id !== reservation.tierId ||
        existingReservation.cadence !== reservation.cadence ||
        existingReservation.public_show_name !== reservation.publicShowName ||
        existingReservation.public_show_amount !== reservation.publicShowAmount ||
        existingReservation.public_show_message !== reservation.publicShowMessage)
    ) {
      throw new CheckoutIdempotencyConflictError();
    }

    const members = await trx
      .selectFrom('subscription')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('project_id', '=', projectId)
      .where('tier_id', '=', tierId)
      .where('status', 'in', ['active', 'grace'])
      .executeTakeFirstOrThrow();

    const now = new Date();
    const reservations = await trx
      .selectFrom('checkout_intent')
      .leftJoin('payment', 'payment.id', 'checkout_intent.id')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('checkout_intent.project_id', '=', projectId)
      .where('checkout_intent.tier_id', '=', tierId)
      .where('checkout_intent.cadence', '!=', 'one_off')
      .where('checkout_intent.expires_at', '>', now)
      .where('checkout_intent.id', '!=', reservation.id)
      .where((eb) =>
        eb.or([
          eb('payment.id', 'is', null),
          eb('payment.status', 'in', ['pending', 'processing']),
        ]),
      )
      .executeTakeFirstOrThrow();
    if (Number(members.count) + Number(reservations.count) >= tier.member_cap) {
      throw new TierMemberCapReachedError();
    }

    await trx
      .insertInto('checkout_intent')
      .values({
        id: reservation.id,
        project_id: reservation.projectId,
        user_id: reservation.userId,
        stripe_checkout_session_id: null,
        currency: reservation.currency,
        project_amount_minor: reservation.projectAmountMinor,
        platform_tip_minor: reservation.platformTipMinor,
        tier_id: reservation.tierId,
        cadence: reservation.cadence,
        public_show_name: reservation.publicShowName,
        public_show_amount: reservation.publicShowAmount,
        public_show_message: reservation.publicShowMessage,
        expires_at: reservation.expiresAt,
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    const result = await operation(trx);
    await afterOperation?.(trx, result);
    return result;
  });
}
