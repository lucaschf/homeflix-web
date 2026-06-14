import { useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Film, Search, Tv, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCatalogLookup, useMovieTmdbSuggestions } from "../../api/hooks";
import type { TmdbSuggestion } from "../../api/types";
import { neutral } from "../../theme/colors";
import { AdminDialog } from "./AdminDialog";

interface TmdbSuggestionsDialogProps {
  open: boolean;
  movieId: string | null;
  /** Title shown above the picker — typically the scanned folder
   *  title so the admin remembers what they're matching against. */
  movieLabel: string;
  onClose: () => void;
  onSelect: (suggestion: TmdbSuggestion) => void;
  /** When non-null, rendered as an inline Alert at the top of the
   *  picker (used to surface backend 422s like "TV relink not
   *  supported yet" without forcing the admin to re-open). */
  errorMessage?: string | null;
  /** Disables card clicks while a relink mutation is in flight. */
  busy?: boolean;
}

/**
 * Modal showing live TMDB candidates (movies + series) for a
 * flagged movie. The admin clicks a card → ``onSelect`` fires with
 * the chosen suggestion; the parent decides what to do (commit
 * the relink, show a confirmation, etc.).
 */
export function TmdbSuggestionsDialog({
  open,
  movieId,
  movieLabel,
  onClose,
  onSelect,
  errorMessage,
  busy = false,
}: TmdbSuggestionsDialogProps) {
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  // Reset the search box whenever the dialog opens or targets a new
  // movie so a leftover query from a previous row doesn't carry over.
  // Render-time reset (see React "you might not need an effect").
  const resetKey = `${open}:${movieId}`;
  const [seenKey, setSeenKey] = useState(resetKey);
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setQuery("");
  }

  const searching = query.trim().length > 0;
  // Seeded suggestions only while the search box is empty; the manual
  // lookup takes over once the admin types.
  const seeded = useMovieTmdbSuggestions(open && !searching ? movieId : null);
  const lookup = useCatalogLookup(open ? query : "");

  const lookupCandidates = lookup.data?.candidates ?? [];
  const movies: TmdbSuggestion[] = searching
    ? lookupCandidates.filter((c) => c.media_type === "movie")
    : (seeded.data?.movies ?? []);
  const series: TmdbSuggestion[] = searching
    ? lookupCandidates.filter((c) => c.media_type === "tv")
    : (seeded.data?.series ?? []);
  const isLoading = searching ? lookup.isFetching : seeded.isLoading;
  const isError = searching ? lookup.isError : seeded.isError;

  const hasResults = movies.length > 0 || series.length > 0;

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
            {t("admin.reviews.dialog.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {movieLabel}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.reviews.dialog.searchPlaceholder")}
          helperText={t("admin.reviews.dialog.searchHint")}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2 }}
        />

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

        {isError && (
          <Alert severity="error">{t("admin.reviews.dialog.fetchError")}</Alert>
        )}

        {!isLoading && !isError && !hasResults && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              {t("admin.reviews.dialog.noResults")}
            </Typography>
          </Box>
        )}

        {movies.length > 0 && (
          <SuggestionSection
            heading={t("admin.reviews.dialog.moviesHeading")}
            icon={<Film size={18} />}
            suggestions={movies}
            onSelect={onSelect}
            disabled={busy}
          />
        )}

        {series.length > 0 && (
          <SuggestionSection
            heading={t("admin.reviews.dialog.seriesHeading")}
            icon={<Tv size={18} />}
            suggestions={series}
            onSelect={onSelect}
            disabled={busy}
            // Surface the limitation upfront so the admin doesn't
            // discover it by clicking and getting a 422.
            hint={t("admin.reviews.dialog.seriesHint")}
          />
        )}
      </DialogContent>
    </AdminDialog>
  );
}

interface SuggestionSectionProps {
  heading: string;
  icon: React.ReactNode;
  suggestions: TmdbSuggestion[];
  onSelect: (suggestion: TmdbSuggestion) => void;
  disabled: boolean;
  hint?: string;
}

function SuggestionSection({
  heading,
  icon,
  suggestions,
  onSelect,
  disabled,
  hint,
}: SuggestionSectionProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {icon}
        <Typography variant="subtitle1">{heading}</Typography>
      </Stack>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {hint}
        </Typography>
      )}
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
        {suggestions.map((s) => (
          <SuggestionCard
            key={`${s.media_type}-${s.tmdb_id}`}
            suggestion={s}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </Box>
    </Box>
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
            {t("admin.reviews.dialog.noPoster")}
          </Box>
        )}
      </Box>
      <Typography variant="body2" noWrap title={suggestion.title}>
        {suggestion.title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {suggestion.year ?? "—"}
        {" · "}
        {t(`admin.reviews.dialog.type.${suggestion.media_type}`)}
        {" · "}tmdb/{suggestion.media_type}/{suggestion.tmdb_id}
      </Typography>
    </Box>
  );
}
