import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { apiErrorCode, apiErrorMeta } from "../../api/errors";
import { useUnlockParental } from "../../api/parental";
import { PinInput } from "./PinInput";
import { formatWait, isCompletePin } from "./pin";

/** Whole seconds left until ``deadline`` (epoch ms), never below zero. */
function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** Kept in the accessibility tree, out of sight. */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

interface ParentalPinDialogProps {
  open: boolean;
  /** This device was unlocked. */
  onUnlocked: () => void;
  /** The user closed the challenge without unlocking. */
  onCancel: () => void;
}

/** Copy for a failed unlock other than a lock, chosen by the error code. */
function unlockErrorKey(err: unknown): string {
  switch (apiErrorCode(err)) {
    case "PARENTAL_PIN_INVALID":
      return "parental.challenge.invalid";
    case "PARENTAL_PIN_NOT_CONFIGURED":
      return "parental.challenge.notConfigured";
    case "DOMAIN_VALIDATION_ERROR":
      return "parental.challenge.pinFormat";
    default:
      return "parental.challenge.failed";
  }
}

/**
 * The parental PIN challenge: one six-digit field that unlocks this device
 * through ``POST /parental/unlock`` (ADR-035).
 *
 * - A wrong PIN keeps the dialog open, clears the field, says so inline and
 *   puts the cursor back in the field.
 * - A locked device (403 ``PARENTAL_PIN_LOCKED``) is locked until
 *   ``details[0].metadata.retry_after_seconds`` from now, shown as a
 *   countdown. Submit stays disabled, so no request leaves until then.
 * - Messages come from the error code, never from the backend's message.
 *
 * ``ParentalPinProvider`` keeps this component mounted while the dialog is
 * closed, so a lock still holds when the challenge opens again.
 */
export function ParentalPinDialog({ open, onUnlocked, onCancel }: ParentalPinDialogProps) {
  const { t } = useTranslation();
  const unlock = useUnlockParental();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The lock is a wall-clock deadline (epoch ms), and ``lockSeconds`` is
  // read from it. Timers pause while a tablet sleeps, so counting ticks
  // would keep submit disabled after the server's lock has ended.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  // Said once when the lock starts, not on every tick of the countdown.
  const [lockAnnouncement, setLockAnnouncement] = useState("");
  // Refusals so far; each one hands focus back to the field once enabled.
  const [failures, setFailures] = useState(0);
  const focusedFailures = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-read the time left from the clock every second, when the page
  // becomes visible again (a woken tablet) and when the challenge opens.
  useEffect(() => {
    if (lockedUntil === null || !open) return;
    const sync = () => {
      const left = secondsUntil(lockedUntil);
      setLockSeconds(left);
      if (left === 0) setLockedUntil(null);
    };
    // A lock that ended while the challenge was closed must not show on
    // reopening.
    sync();
    const timer = window.setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [lockedUntil, open]);

  const locked = lockSeconds > 0;
  const busy = unlock.isPending;
  const canSubmit = isCompletePin(pin) && !locked && !busy;

  // After a refusal the Unlock button that had focus is disabled (the field
  // was cleared), so focus returns to the field once it is enabled again.
  useEffect(() => {
    if (busy || failures === focusedFailures.current) return;
    focusedFailures.current = failures;
    inputRef.current?.focus();
  }, [failures, busy]);

  const reset = () => {
    setPin("");
    setError(null);
  };

  const handleCancel = () => {
    // An unlock already on the wire would open the window with no caller
    // left to use it, so the challenge cannot be dismissed mid-request.
    if (busy) return;
    reset();
    onCancel();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await unlock.mutateAsync({ pin });
      reset();
      onUnlocked();
    } catch (err) {
      setPin("");
      setFailures((count) => count + 1);
      if (apiErrorCode(err) === "PARENTAL_PIN_LOCKED") {
        const wait = apiErrorMeta(err, "retry_after_seconds");
        if (typeof wait === "number" && wait > 0) {
          const seconds = Math.ceil(wait);
          setLockedUntil(Date.now() + seconds * 1000);
          setLockSeconds(seconds);
          setLockAnnouncement(
            t("parental.challenge.lockedAnnouncement", { count: Math.ceil(seconds / 60) }),
          );
        } else {
          setError(t("parental.challenge.lockedNoWait"));
        }
        return;
      }
      setError(t(unlockErrorKey(err)));
    }
  };

  // The countdown is not a live region: it would be announced every second.
  // It stays tied to the field through the helper text's aria-describedby,
  // and the status region below announces the lock once when it starts.
  const helperText = locked ? (
    t("parental.challenge.locked", { time: formatWait(lockSeconds) })
  ) : error ? (
    <span role="alert">{error}</span>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="parental-pin-dialog-title"
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle id="parental-pin-dialog-title">{t("parental.challenge.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("parental.challenge.body")}</DialogContentText>
          <PinInput
            autoFocus
            inputRef={inputRef}
            label={t("parental.challenge.pinLabel")}
            value={pin}
            onChange={setPin}
            disabled={busy}
            error={locked || error !== null}
            helperText={helperText}
          />
          <Box role="status" sx={VISUALLY_HIDDEN}>
            {locked ? lockAnnouncement : ""}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={busy} color="inherit">
            {t("parental.challenge.cancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {busy ? t("parental.challenge.submitting") : t("parental.challenge.submit")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
