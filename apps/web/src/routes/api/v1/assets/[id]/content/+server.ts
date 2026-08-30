import { BUCKETS, normalizeContentType } from '@oss-tips/storage';
import type { RequestHandler } from './$types';
import { problem } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import {
  isPublicAssetId,
  parsePublicAssetVariant,
  publicAssetHeaders,
  resolvePublicAsset,
} from '$lib/server/public-assets';

/** Stream a completed public asset through this origin; private objects never enter this path. */
export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!isPublicAssetId(event.params.id)) return problem(404, 'Asset not found');
  const parsedVariant = parsePublicAssetVariant(event.url.searchParams.get('variant'));
  if (!parsedVariant.ok) return problem(400, 'Invalid asset variant');

  const asset = await resolvePublicAsset(getDb(), event.params.id, parsedVariant.value);
  if (!asset) return problem(404, 'Asset not found');

  try {
    const object = await getStorage().getObjectStream(BUCKETS.publicMedia, asset.storageKey);
    let contentTypeMatches = true;
    if (object.contentType !== undefined) {
      try {
        contentTypeMatches = normalizeContentType(object.contentType) === asset.contentType;
      } catch {
        contentTypeMatches = false;
      }
    }
    if (object.contentLength !== asset.contentLength || !contentTypeMatches) {
      await object.body.cancel();
      return problem(503, 'Storage unavailable', 'Public asset metadata mismatch');
    }
    return new Response(object.body, { headers: publicAssetHeaders(asset) });
  } catch {
    return problem(503, 'Storage unavailable', 'Public asset read failed');
  }
};
