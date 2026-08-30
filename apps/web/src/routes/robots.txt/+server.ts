import type { RequestHandler } from './$types';
import { renderRobots } from '$lib/seo';
import { publicBaseUrl } from '../api/api-utils';

export const GET: RequestHandler = ({ url }) =>
  new Response(renderRobots(publicBaseUrl(url)), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
