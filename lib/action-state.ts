/**
 * Shared Server Action result contract.
 *
 * This lives outside the "use server" modules on purpose: a "use server" file
 * may only export async functions, so `IDLE` (a plain object) cannot be
 * re-exported from one. Client components import both from here.
 */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Field-keyed validation messages, plus occasional action metadata. */
  fieldErrors?: Record<string, string>;
  /** Id of the row an action just created, when the caller needs it. */
  id?: string;
};

export const IDLE: ActionState = { ok: false };
