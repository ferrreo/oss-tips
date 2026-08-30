import { PublicSupporterSchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  readPublicSupportAdjustments,
  visiblePublicSupportPayments,
} from '$lib/server/public-supporters';
import { jsonWithEtag, problem } from '../../../../api-utils';
import { toPublicSupporter } from '../../../../public-api';

export const GET: RequestHandler = async ({ params, request }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug) return problem(400, 'Missing project slug');

  const db = getDb();
  const rows = await db
    .selectFrom('payment')
    .innerJoin('project', 'project.id', 'payment.project_id')
    .leftJoin('checkout_intent', 'checkout_intent.id', 'payment.id')
    .leftJoin('tier', 'tier.id', 'checkout_intent.tier_id')
    .leftJoin('supporter_public_profile', (join) =>
      join
        .onRef('supporter_public_profile.project_id', '=', 'payment.project_id')
        .onRef('supporter_public_profile.user_id', '=', 'payment.user_id'),
    )
    .select([
      'payment.id',
      'payment.user_id',
      'payment.project_amount_minor',
      'payment.status',
      'payment.settled_at',
      'payment.created_at',
      'payment.cadence',
      'payment.public_show_name',
      'payment.public_show_amount',
      'payment.public_show_message',
      'payment.public_display_name',
      'payment.public_message',
      'tier.one_off_duration as duration',
      'payment.currency',
      'supporter_public_profile.display_name',
      'supporter_public_profile.show_name',
      'supporter_public_profile.show_amount',
      'supporter_public_profile.show_message',
    ])
    .where('project.slug', '=', params.slug)
    .where('project.status', '=', 'published')
    .where('project.public_show_supporters', '=', true)
    .where('payment.status', 'in', ['succeeded', 'refunded', 'disputed'])
    .orderBy('payment.created_at', 'desc')
    .limit(100)
    .execute();
  const adjustments = await readPublicSupportAdjustments(
    db,
    rows.map((row) => row.id),
  );
  const payload = visiblePublicSupportPayments(rows, adjustments).map(({ row, amountMinor }) =>
    PublicSupporterSchema.parse(
      toPublicSupporter({
        display_name: row.display_name ?? row.public_display_name ?? null,
        show_name: row.public_show_name && (row.show_name ?? true),
        show_amount: row.public_show_amount && (row.show_amount ?? true),
        show_message: row.public_show_message && (row.show_message ?? true),
        amount: amountMinor,
        currency: row.currency,
        message: row.public_message,
        duration: row.duration,
        created_at: row.created_at,
      }),
    ),
  );
  return jsonWithEtag(request, payload);
};
