import { redirect, type Actions } from '@sveltejs/kit';
import { decideProjectReview } from '$lib/server/admin-actions';

export const actions: Actions = {
  approve: async (event) => {
    await decideProjectReview(event, 'approved');
    throw redirect(303, event.url.pathname);
  },
  hold: async (event) => {
    await decideProjectReview(event, 'pending');
    throw redirect(303, event.url.pathname);
  },
  reject: async (event) => {
    await decideProjectReview(event, 'rejected');
    throw redirect(303, event.url.pathname);
  },
};
