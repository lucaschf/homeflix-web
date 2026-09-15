import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { apiErrorCode } from "../../api/errors";
import { useRemoveParentalPin, useSetParentalPin } from "../../api/parental";
import { PinInput } from "./PinInput";
import { isCompletePin } from "./pin";

export type ParentalPinSetupMode = "set" | "change" | "remove";

interface ParentalPinSetupDialogProps {
  /** What the dialog does; ``null`` keeps it closed. */
  mode: ParentalPinSetupMode | null;
  onClose: () => void;
  /** The PIN was saved or removed. */
  onDone: (mode: ParentalPinSetupMode) => void;
}

const TITLE_KEY: Record<ParentalPinSetupMode, string> = {
  set: "parental.setup.setTitle",
  change: "parental.setup.changeTitle",
  remove: "parental.setup.removeTitle",
};

/** Copy for a failed PIN update, chosen by the error code. */
function setupErrorKey(err: unknown): string {
  switch (apiErrorCode(err)) {
    case "ACCOUNT_PASSWORD_INVALID":
      return "parental.setup.errors.passwordInvalid";
    case "PARENTAL_PIN_IN_USE":
      return "parental.setup.errors.pinInUse";
    case "DOMAIN_VALIDATION_ERROR":
      return "parental.setup.errors.pinFormat";
    default:
      return "parental.setup.errors.failed";
  }
}

/**
 * Sets, changes or removes the account's parental PIN with the account
 * password (ADR-035, Amendment 7 D3).
 *
 * The password is the PIN's root of trust and the app cannot change it, so
 * the dialog tells the parent to type it away from the child. Both fields
 * are cleared whenever the dialog closes, and errors are shown by code.
 */
export function ParentalPinSetupDialog({ mode, onClose, onDone }: ParentalPinSetupDialogProps) {
  const { t } = useTranslation();
  const setPinMutation = useSetParentalPin();
  const removePinMutation = useRemoveParentalPin();
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The last open mode, so the title and fields do not change while the
  // dialog fades out after ``mode`` turns ``null``.
  const [shownMode, setShownMode] = useState(mode);
  if (mode !== null && mode !== shownMode) setShownMode(mode);
  const current = mode ?? shownMode;

  const removing = current === "remove";
  const busy = setPinMutation.isPending || removePinMutation.isPending;
  const canSubmit = password.length > 0 && (removing || isCompletePin(pin)) && !busy;

  const reset = () => {
    setPassword("");
    setPin("");
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode || !canSubmit) return;
    setError(null);
    try {
      if (removing) {
        await removePinMutation.mutateAsync({ current_password: password });
      } else {
        await setPinMutation.mutateAsync({ current_password: password, pin });
      }
      reset();
      onDone(mode);
    } catch (err) {
      setPassword("");
      setError(t(setupErrorKey(err)));
    }
  };

  return (
    <Dialog
      open={mode !== null}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="parental-pin-setup-title"
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle id="parental-pin-setup-title">
          {current ? t(TITLE_KEY[current]) : null}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t("parental.setup.guidance")}</DialogContentText>
          {error && (
            <Typography role="alert" color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          <TextField
            autoFocus
            fullWidth
            type="password"
            autoComplete="current-password"
            label={t("parental.setup.passwordLabel")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            margin="normal"
          />
          {!removing && (
            <PinInput
              label={t("parental.setup.pinLabel")}
              value={pin}
              onChange={setPin}
              disabled={busy}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={busy} color="inherit">
            {t("parental.setup.cancel")}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color={removing ? "error" : "primary"}
            disabled={!canSubmit}
          >
            {removing ? t("parental.setup.confirmRemove") : t("parental.setup.save")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
