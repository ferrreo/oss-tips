import type { RequestHandler } from './$types';
import { problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import {
  isPublicAssetId,
  parsePublicAssetVariant,
  publicAssetMetadata,
  resolvePublicAsset,
} from '$lib/server/public-assets';

/** Return metadata and a same-origin URL for a public asset or variant. */
export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!isPublicAssetId(event.params.id)) return problem(404, 'Asset not found');
  const parsedVariant = parsePublicAssetVariant(event.url.searchParams.get('variant'));
  if (!parsedVariant.ok) {
    return problem(400, 'Invalid asset variant');
  }

  const asset = await resolvePublicAsset(getDb(), event.params.id, parsedVariant.value);
  return asset
    ? json(publicAssetMetadata(asset), { headers: { 'cache-control': 'public, max-age=60' } })
    : problem(404, 'Asset not found');
};
