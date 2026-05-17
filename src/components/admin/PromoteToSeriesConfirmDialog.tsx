import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TmdbSuggestion } from "../../api/types";

interface PromoteToSeriesConfirmDialogProps {
  open: boolean;
  movieLabel: string;
  pick: TmdbSuggestion | null;
  busy: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Two-step gate before the destructive Movie → Series conversion.
 *
 * The conversion soft-deletes the original movie row, replaces it
 * with a series structure, and triggers cross-BC handlers that
 * wipe the user's play progress for that movie (watchlist /
 * custom-list entries survive — they get rewritten to the new
 * series id). All of this is irreversible without a manual DB
 * intervention, so we surface the impact in plain language and
 * force an explicit confirmation click.
 */
export function PromoteToSeriesConfirmDialog({
  open,
  movieLabel,
  pick,
  busy,
  errorMessage,
  onCancel,
  onConfirm,
}: PromoteToSeriesConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("admin.reviews.promote.title")}</DialogTitle>
      <DialogContent>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <Stack spacing={2}>
          <Typography variant="body2">
            {t("admin.reviews.promote.lead", { movie: movieLabel })}
          </Typography>
          {pick && (
            <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t("admin.reviews.promote.willCreate")}
              </Typography>
              <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                {pick.title} {pick.year ? `(${pick.year})` : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                tmdb/tv/{pick.tmdb_id}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t("admin.reviews.promote.consequencesTitle")}
            </Typography>
            <Box component="ul" sx={{ pl: 3, my: 0 }}>
              <Typography component="li" variant="body2">
                {t("admin.reviews.promote.consequenceMovieDeleted")}
              </Typography>
              <Typography component="li" variant="body2">
                {t("admin.reviews.promote.consequenceProgressCleared")}
              </Typography>
              <Typography component="li" variant="body2">
                {t("admin.reviews.promote.consequenceListsMigrated")}
              </Typography>
              <Typography component="li" variant="body2">
                {t("admin.reviews.promote.consequenceFilesOnFirstEpisode")}
              </Typography>
            </Box>
          </Box>
          <Alert severity="warning" variant="outlined">
            {t("admin.reviews.promote.irreversibleWarning")}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {t("admin.reviews.promote.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy || !pick}
          variant="contained"
          color="warning"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {busy
            ? t("admin.reviews.promote.confirming")
            : t("admin.reviews.promote.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
