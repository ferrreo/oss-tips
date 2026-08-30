import { redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import {
  issueExceptionalRefund,
  restrictCasePayments,
  updateCaseNote,
  updateCaseStatus,
} from '$lib/server/admin-actions';

function returnToCases(event: RequestEvent): never {
  throw redirect(303, event.url.pathname);
}

export const actions: Actions = {
  addNote: async (event) => {
    await updateCaseNote(event);
    returnToCases(event);
  },
  setStatus: async (event) => {
    await updateCaseStatus(event);
    returnToCases(event);
  },
  restrictPayments: async (event) => {
    await restrictCasePayments(event);
    returnToCases(event);
  },
  exceptionalRefund: async (event) => {
    await issueExceptionalRefund(event);
    returnToCases(event);
  },
};
