import {
  Alert,
  Box,
  CircularProgress,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { Tv, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSeriesTmdbSuggestions } from "../../api/hooks";
import type { TmdbSuggestion } from "../../api/types";
import { neutral } from "../../theme/colors";
import { AdminDialog } from "./AdminDialog";

interface SeriesTmdbSuggestionsDialogProps {
  open: boolean;
  seriesId: string | null;
  /** Title shown above the picker — typically the stored series
   *  title so the admin remembers what they're matching against. */
  seriesLabel: string;
  onClose: () => void;
  onSelect: (suggestion: TmdbSuggestion) => void;
  /** When non-null, rendered as an inline Alert at the top of the
   *  picker (used to surface backend errors without re-opening). */
  errorMessage?: string | null;
  /** Disables card clicks while a relink mutation is in flight. */
  busy?: boolean;
}

/**
 * Modal showing live TMDB TV candidates for a flagged series. The
 * admin clicks a card → ``onSelect`` fires with the chosen suggestion;
 * the parent commits the relink. TV-only by design — re-pointing a
 * series at a movie isn't supported.
 */
export function SeriesTmdbSuggestionsDialog({
  open,
  seriesId,
  seriesLabel,
  onClose,
  onSelect,
  errorMessage,
  busy = false,
}: SeriesTmdbSuggestionsDialogProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSeriesTmdbSuggestions(open ? seriesId : null);

  const hasResults = !!data && data.series.length > 0;

  return (
    <AdminDialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="div" noWrap>
            {t("admin.seriesReviews.dialog.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {seriesLabel}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress color="primary" />
          </Box>
        )}

        {isError && <Alert severity="error">{t("admin.seriesReviews.dialog.fetchError")}</Alert>}

        {!isLoading && !isError && !hasResults && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              {t("admin.seriesReviews.dialog.noResults")}
            </Typography>
          </Box>
        )}

        {data && data.series.length > 0 && (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Tv size={18} />
              <Typography variant="subtitle1">
                {t("admin.seriesReviews.dialog.seriesHeading")}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(5, 1fr)",
                },
                gap: 2,
              }}
            >
              {data.series.map((s) => (
                <SuggestionCard
                  key={`${s.media_type}-${s.tmdb_id}`}
                  suggestion={s}
                  onSelect={onSelect}
                  disabled={busy}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
    </AdminDialog>
  );
}

interface SuggestionCardProps {
  suggestion: TmdbSuggestion;
  onSelect: (suggestion: TmdbSuggestion) => void;
  disabled: boolean;
}

function SuggestionCard({ suggestion, onSelect, disabled }: SuggestionCardProps) {
  const { t } = useTranslation();
  return (
    <Box
      onClick={() => {
        if (!disabled) onSelect(suggestion);
      }}
      sx={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        borderRadius: 1,
        overflow: "hidden",
        transition: "transform 0.15s ease",
        "&:hover": disabled ? {} : { transform: "translateY(-2px)" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "2/3",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          mb: 1,
        }}
      >
        {suggestion.poster_url ? (
          <Box
            component="img"
            src={suggestion.poster_url}
            alt={suggestion.title}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: neutral[600],
              fontSize: 12,
              textAlign: "center",
              p: 1,
            }}
          >
            {t("admin.seriesReviews.dialog.noPoster")}
          </Box>
        )}
      </Box>
      <Typography variant="body2" noWrap title={suggestion.title}>
        {suggestion.title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {suggestion.year ?? "—"}
        {" · "}tmdb/{suggestion.media_type}/{suggestion.tmdb_id}
      </Typography>
    </Box>
  );
}
