import { createContext, useContext } from "react";

/** Rejection of ``run`` or ``unlock`` when the user closes the PIN challenge. */
export class ParentalChallengeCancelledError extends Error {
  constructor() {
    super("Parental PIN challenge cancelled");
    this.name = "ParentalChallengeCancelledError";
  }
}

/** Whether ``err`` means the user dismissed the challenge (nothing to report). */
export function isParentalChallengeCancelled(err: unknown): err is ParentalChallengeCancelledError {
  return err instanceof ParentalChallengeCancelledError;
}

export interface ParentalUnlock {
  /**
   * Runs ``fn``; when it fails with 403 ``PARENTAL_PIN_REQUIRED``, opens the
   * PIN challenge and, once this device is unlocked, runs ``fn`` exactly
   * once more.
   *
   * The retry is safe because the backend gate refuses before any write and
   * consumes the unlock (ADR-035, D9). Whatever the retry does is final: a
   * second ``PARENTAL_PIN_REQUIRED`` rejects to the caller, which reports it,
   * and never reopens the challenge. Closing the challenge rejects with
   * ``ParentalChallengeCancelledError`` without retrying. With
   * ``PARENTAL_CONTROLS_ENABLED`` off, every error passes through untouched.
   *
   * ``fn`` must be a mutation marked ``PARENTAL_GATE_HANDLED_BY_CALLER``, so
   * the query client does not open a second challenge for it.
   */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /**
   * Opens the PIN challenge on its own and resolves once this device is
   * unlocked; rejects with ``ParentalChallengeCancelledError`` when closed.
   * A call while a challenge is open joins it.
   */
  unlock(): Promise<void>;
}

export const ParentalUnlockContext = createContext<ParentalUnlock | null>(null);

/** The PIN challenge of the enclosing ``ParentalPinProvider``. */
export function useParentalUnlock(): ParentalUnlock {
  const ctx = useContext(ParentalUnlockContext);
  if (!ctx) {
    throw new Error("useParentalUnlock must be used within a ParentalPinProvider");
  }
  return ctx;
}
