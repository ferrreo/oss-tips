import { checkPlatform } from '@oss-tips/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { problem } from '../../routes/api/api-utils';

export function requirePlatformReviewer(
  event: Pick<RequestEvent, 'locals'>,
): { userId: string } | Response {
  const session = event.locals.session;
  if (!session) return problem(401, 'Authentication required');
  if (
    !event.locals.actor ||
    !checkPlatform(event.locals.actor, 'platform.review_projects').allowed
  ) {
    return problem(403, 'Operator permission required');
  }
  return { userId: session.user.id };
}
