// Shared vocabulary between the query client, the profile hooks and the
// PIN challenge UI for 403 ``PARENTAL_PIN_REQUIRED`` (ADR-035).
//
// Kept in its own module, free of hooks, so ``auth.ts`` and
// ``queryClient.ts`` can both import it without importing each other
// through ``parental.ts``.

import { apiErrorCode } from "./errors";

/**
 * Window event the query client dispatches when a mutation that no
 * caller guards with ``useParentalUnlock().run`` is refused with 403
 * ``PARENTAL_PIN_REQUIRED``. ``ParentalPinProvider`` listens to it and
 * opens the PIN challenge; the mutation itself is never sent again.
 *
 * An event keeps ``queryClient.ts`` free of React, the same way
 * ``AUTH_EXPIRED_EVENT`` keeps ``client.ts`` free of the router.
 */
export const PARENTAL_PIN_REQUIRED_EVENT = "homeflix:parental-pin-required";

/**
 * Mutation ``meta`` of a mutation whose every caller runs it through
 * ``useParentalUnlock().run``. ``run`` owns the challenge and the single
 * retry for it, so the query client's global handler skips it rather
 * than open a second challenge.
 */
export const PARENTAL_GATE_HANDLED_BY_CALLER = { parentalGate: "caller" } as const;

/** Whether a mutation's ``meta`` says its caller handles the parental gate. */
export function isParentalGateHandledByCaller(meta: Record<string, unknown> | undefined): boolean {
  return meta?.parentalGate === PARENTAL_GATE_HANDLED_BY_CALLER.parentalGate;
}

/** Whether ``err`` is the backend asking for a parental unlock first. */
export function isParentalPinRequired(err: unknown): boolean {
  return apiErrorCode(err) === "PARENTAL_PIN_REQUIRED";
}
