import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setParentalUnlockHandler } from "../../api/client";
import { isParentalPinRequired } from "../../api/parentalGate";
import { PARENTAL_CONTROLS_ENABLED } from "../../config/featureFlags";
import { ParentalPinDialog } from "./ParentalPinDialog";
import {
  ParentalChallengeCancelledError,
  type ParentalUnlock,
  ParentalUnlockContext,
} from "./useParentalUnlock";

interface PendingChallenge {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Error) => void;
}

/**
 * Owns the app's single parental PIN challenge (ADR-035) and exposes it
 * through ``useParentalUnlock``.
 *
 * Two ways in:
 * - ``run(fn)`` and ``unlock()``, for flows that know what to do after the
 *   unlock (profile switch and edits, the admin lock screen).
 * - The API client, which gets ``unlock`` as its parental unlock handler
 *   while this provider is mounted. A write nobody guards (an admin write,
 *   D10) refused with ``PARENTAL_PIN_REQUIRED`` opens the challenge from
 *   there and, after the unlock, is sent again, so the action carries on.
 *
 * Requests that arrive while the challenge is open share it, so several
 * refusals in a row open one dialog. With ``PARENTAL_CONTROLS_ENABLED`` off
 * nothing opens: ``run`` passes every error through and the API client gets
 * no handler.
 *
 * Mount inside ``QueryClientProvider``.
 */
export function ParentalPinProvider({ children }: { children: ReactNode }) {
  const pending = useRef<PendingChallenge | null>(null);
  const [open, setOpen] = useState(false);

  const unlock = useCallback((): Promise<void> => {
    if (pending.current) return pending.current.promise;
    let resolve!: () => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    pending.current = { promise, resolve, reject };
    setOpen(true);
    return promise;
  }, []);

  const settle = useCallback((unlocked: boolean) => {
    const challenge = pending.current;
    pending.current = null;
    setOpen(false);
    if (!challenge) return;
    if (unlocked) challenge.resolve();
    else challenge.reject(new ParentalChallengeCancelledError());
  }, []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (!PARENTAL_CONTROLS_ENABLED || !isParentalPinRequired(err)) throw err;
      }
      await unlock();
      // Exactly one retry, and its outcome is final (see ``ParentalUnlock.run``).
      return fn();
    },
    [unlock],
  );

  useEffect(() => {
    if (!PARENTAL_CONTROLS_ENABLED) return;
    setParentalUnlockHandler(unlock);
    return () => setParentalUnlockHandler(null);
  }, [unlock]);

  const value = useMemo<ParentalUnlock>(() => ({ run, unlock }), [run, unlock]);

  return (
    <ParentalUnlockContext.Provider value={value}>
      {children}
      <ParentalPinDialog
        open={open}
        onUnlocked={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ParentalUnlockContext.Provider>
  );
}
