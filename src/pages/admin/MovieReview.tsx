import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AlertCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMoviesNeedingReview, useRelinkMovie } from "../../api/hooks";
import type { NeedsReviewMovie, TmdbSuggestion } from "../../api/types";
import { TmdbSuggestionsDialog } from "../../components/admin/TmdbSuggestionsDialog";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { neutral } from "../../theme/colors";

type Snack = { message: string; severity: "success" | "error" | "warning" } | null;

export function MovieReview() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.reviews.title"));

  const { data: movies, isLoading, isError, refetch } = useMoviesNeedingReview();
  const relink = useRelinkMovie();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeMovie, setActiveMovie] = useState<NeedsReviewMovie | null>(null);
  // Inline dialog warning — used to surface backend errors (like the
  // TV-pick 422) without forcing the admin to close + reopen.
  const [dialogWarning, setDialogWarning] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const openPicker = (movie: NeedsReviewMovie) => {
    setActiveMovie(movie);
    setDialogWarning(null);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    // Keep activeMovie around briefly so the closing animation
    // still has the title to render.
    setDialogWarning(null);
  };

  const onSuggestionSelected = async (suggestion: TmdbSuggestion) => {
    if (!activeMovie) return;
    setDialogWarning(null);
    try {
      const result = await relink.mutateAsync({
        movieId: activeMovie.id,
        tmdb_id: suggestion.tmdb_id,
        media_type: suggestion.media_type,
      });
      if (result.enriched) {
        setSnack({
          message: t("admin.reviews.snack.success", { title: activeMovie.title }),
          severity: "success",
        });
        closePicker();
      } else {
        // Backend completed the call but enrichment failed (e.g. TMDB
        // id was unreachable). Keep the dialog open so the admin can
        // try another candidate.
        setDialogWarning(
          result.error ?? t("admin.reviews.snack.enrichmentFailed"),
        );
      }
    } catch (err) {
      // 422 for TV picks lands here. Surface inline so the admin
      // can pick a different candidate without reopening.
      const message = err instanceof Error ? err.message : t("admin.reviews.snack.relinkFailed");
      setDialogWarning(message);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} mb={3}>
        <Typography variant="h2">{t("admin.reviews.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("admin.reviews.subtitle")}
        </Typography>
      </Stack>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("admin.reviews.retry")}
            </Button>
          }
        >
          {t("admin.reviews.loadError")}
        </Alert>
      )}

      {!isLoading && !isError && movies && movies.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Stack spacing={2} alignItems="center">
            <AlertCircle size={48} color={neutral[600]} />
            <Typography variant="body1">{t("admin.reviews.empty")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("admin.reviews.emptyHint")}
            </Typography>
          </Stack>
        </Paper>
      )}

      {movies && movies.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("admin.reviews.table.title")}</TableCell>
                <TableCell>{t("admin.reviews.table.year")}</TableCell>
                <TableCell>{t("admin.reviews.table.filePath")}</TableCell>
                <TableCell align="right">{t("admin.reviews.table.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movies.map((movie) => (
                <TableRow key={movie.id} hover>
                  <TableCell>{movie.title}</TableCell>
                  <TableCell>{movie.year}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 380,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "text.secondary",
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                    title={movie.file_path ?? ""}
                  >
                    {movie.file_path ?? "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Search size={14} />}
                      onClick={() => openPicker(movie)}
                    >
                      {t("admin.reviews.findOnTmdb")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TmdbSuggestionsDialog
        open={pickerOpen}
        movieId={activeMovie?.id ?? null}
        movieLabel={
          activeMovie ? `${activeMovie.title} (${activeMovie.year})` : ""
        }
        onClose={closePicker}
        onSelect={onSuggestionSelected}
        errorMessage={dialogWarning}
        busy={relink.isPending}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            onClose={() => setSnack(null)}
            sx={{ width: "100%" }}
          >
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  );
}
