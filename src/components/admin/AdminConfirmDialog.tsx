import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AdminButton } from "./AdminButton";

interface AdminConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  /** Optional lead paragraph above the consequences list. */
  body?: ReactNode;
  /** Each entry becomes a bullet item explaining one downstream
   *  effect of the destructive action. Keep them short. */
  consequences?: ReactNode[];
  /** When ``true`` the confirm button uses the danger variant
   *  (red tint) and the warning Alert is rendered at the bottom. */
  danger?: boolean;
  /** Whether the mutation is in flight; disables both buttons
   *  and replaces the confirm label with a spinner + ``confirmingLabel``. */
  busy?: boolean;
  /** Backend error surfaced inline. Keeps the dialog open so the
   *  operator can retry without losing context. */
  errorMessage?: string | null;
  confirmLabel?: ReactNode;
  confirmingLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for irreversible / high-impact admin actions
 * (delete library, promote to series, force-clear cache, etc.).
 *
 * Generalised from the original ``PromoteToSeriesConfirmDialog``
 * so every destructive flow uses the same affordance: title at the
 * top, optional lead copy, bulleted consequences list, irreversible
 * warning Alert when ``danger`` is set, Cancel + Confirm action row.
 *
 * The dialog blocks dismissal while ``busy`` is ``true`` so the
 * user can't fire the mutation twice by accident or interrupt it
 * mid-flight.
 */
export function AdminConfirmDialog({
  open,
  title,
  body,
  consequences,
  danger = false,
  busy = false,
  errorMessage,
  confirmLabel,
  confirmingLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: AdminConfirmDialogProps) {
  const { t } = useTranslation();
  const finalConfirmLabel = confirmLabel ?? t("admin.confirm.confirm", "Confirm");
  const finalConfirmingLabel =
    confirmingLabel ?? t("admin.confirm.confirming", "Working…");
  const finalCancelLabel = cancelLabel ?? t("admin.confirm.cancel", "Cancel");

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <Stack spacing={2}>
          {body && <Typography variant="body2">{body}</Typography>}
          {consequences && consequences.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t("admin.confirm.consequencesTitle", "What will happen")}
              </Typography>
              <Box component="ul" sx={{ pl: 3, my: 0 }}>
                {consequences.map((line, i) => (
                  <Typography key={i} component="li" variant="body2" sx={{ mb: 0.5 }}>
                    {line}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
          {danger && (
            <Alert severity="warning" variant="outlined">
              {t(
                "admin.confirm.irreversibleWarning",
                "This action is irreversible from the UI.",
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <AdminButton onClick={onCancel} disabled={busy} variant="ghost">
          {finalCancelLabel}
        </AdminButton>
        <AdminButton
          onClick={onConfirm}
          disabled={busy}
          variant={danger ? "danger" : "primary"}
          icon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {busy ? finalConfirmingLabel : finalConfirmLabel}
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}
