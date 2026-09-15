import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isParentalPinRequired, PARENTAL_PIN_REQUIRED_EVENT } from "../../api/parentalGate";
import { PARENTAL_CONTROLS_ENABLED } from "../../config/featureFlags";
import { useToast } from "../ToastProvider";
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
 * - ``PARENTAL_PIN_REQUIRED_EVENT``, dispatched by the query client when a
 *   write nobody guards (an admin write, D10) is refused. The challenge
 *   opens and, after the unlock, a toast asks the user to repeat the
 *   action: the write is never replayed for them.
 *
 * Requests that arrive while the challenge is open share it, so several
 * refusals in a row open one dialog. With ``PARENTAL_CONTROLS_ENABLED`` off
 * nothing opens: ``run`` passes every error through and the event is
 * ignored.
 *
 * Mount inside ``QueryClientProvider`` and ``ToastProvider``.
 */
export function ParentalPinProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
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
    const onPinRequired = () => {
      if (!PARENTAL_CONTROLS_ENABLED) return;
      unlock().then(
        () =>
          showToast(t("parental.challenge.repeatAction"), { severity: "info", durationMs: 6000 }),
        () => {
          // Closed without unlocking: the refused action already reported
          // its own error, so there is nothing to add.
        },
      );
    };
    window.addEventListener(PARENTAL_PIN_REQUIRED_EVENT, onPinRequired);
    return () => window.removeEventListener(PARENTAL_PIN_REQUIRED_EVENT, onPinRequired);
  }, [unlock, showToast, t]);

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
