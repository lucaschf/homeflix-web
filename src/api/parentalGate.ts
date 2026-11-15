// Shared vocabulary between the profile hooks and the PIN challenge UI
// for 403 ``PARENTAL_PIN_REQUIRED`` (ADR-035).
//
// Kept in its own module, free of hooks, so ``auth.ts`` and the pages
// can import it without importing each other through ``parental.ts``.

import { apiErrorCode } from "./errors";

/**
 * Request option of a write whose every caller runs it through
 * ``useParentalUnlock().run``. ``run`` owns the challenge and the single
 * retry for it, so the API client skips its own challenge and replay
 * rather than open a second one. Pass it as the ``api`` call's options.
 */
export const PARENTAL_GATE_HANDLED_BY_CALLER = { parentalGate: "caller" } as const;

/** Whether ``err`` is the backend asking for a parental unlock first. */
export function isParentalPinRequired(err: unknown): boolean {
  return apiErrorCode(err) === "PARENTAL_PIN_REQUIRED";
}
