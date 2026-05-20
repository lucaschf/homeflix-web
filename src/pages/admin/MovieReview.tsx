import { useState } from "react";
import { Box, Snackbar, Typography } from "@mui/material";
import { AlertCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useMoviesNeedingReview,
  usePagedList,
  usePromoteMovieToSeries,
  useRelinkMovie,
} from "../../api/hooks";
import type { NeedsReviewMovie, TmdbSuggestion } from "../../api/types";
import {
  AdminButton,
  AdminEmptyState,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  type AdminTableColumn,
} from "../../components/admin";
import { PromoteToSeriesConfirmDialog } from "../../components/admin/PromoteToSeriesConfirmDialog";
import { TmdbSuggestionsDialog } from "../../components/admin/TmdbSuggestionsDialog";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Snack = { message: string; severity: "success" | "error" | "warning" } | null;

export function MovieReview() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.reviews.title"));

  const { data: movies, isLoading, isError, refetch } = useMoviesNeedingReview();
  const relink = useRelinkMovie();
  const promote = usePromoteMovieToSeries();

  const [pageSize, setPageSize] = useState(10);
  const allMovies = movies ?? [];
  const paged = usePagedList<NeedsReviewMovie>(allMovies, pageSize);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeMovie, setActiveMovie] = useState<NeedsReviewMovie | null>(null);
  // Inline dialog warning — used to surface backend errors (like the
  // TV-pick 422) without forcing the admin to close + reopen.
  const [dialogWarning, setDialogWarning] = useState<string | null>(null);
  // TV-card picks first land here so the user sees the consequence
  // list ("movie deleted, progress wiped, lists migrated") and has
  // to confirm before the irreversible mutation fires.
  const [pendingPromotion, setPendingPromotion] = useState<TmdbSuggestion | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
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

  const closePromote = () => {
    setPendingPromotion(null);
    setPromoteError(null);
  };

  const onSuggestionSelected = async (suggestion: TmdbSuggestion) => {
    if (!activeMovie) return;
    setDialogWarning(null);

    // Series pick → confirmation gate. The promote is irreversible
    // and touches three BCs; the admin gets a chance to read the
    // impact list before committing.
    if (suggestion.media_type === "tv") {
      setPendingPromotion(suggestion);
      return;
    }

    try {
      const result = await relink.mutateAsync({
        movieId: activeMovie.id,
        tmdb_id: suggestion.tmdb_id,
        media_type: "movie",
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
        setDialogWarning(result.error ?? t("admin.reviews.snack.enrichmentFailed"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.reviews.snack.relinkFailed");
      setDialogWarning(message);
    }
  };

  const confirmPromote = async () => {
    if (!activeMovie || !pendingPromotion) return;
    setPromoteError(null);
    try {
      await promote.mutateAsync({
        movieId: activeMovie.id,
        tmdb_id: pendingPromotion.tmdb_id,
      });
      setSnack({
        message: t("admin.reviews.snack.promoteSuccess", { title: activeMovie.title }),
        severity: "success",
      });
      closePromote();
      closePicker();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("admin.reviews.snack.promoteFailed");
      setPromoteError(message);
    }
  };

  const columns: AdminTableColumn<NeedsReviewMovie>[] = [
    {
      id: "title",
      label: t("admin.reviews.table.title"),
      render: (m) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {m.title}
        </Typography>
      ),
    },
    {
      id: "year",
      label: t("admin.reviews.table.year"),
      width: "90px",
      mono: true,
      muted: true,
      render: (m) => m.year,
    },
    {
      id: "file_path",
      label: t("admin.reviews.table.filePath"),
      mono: true,
      muted: true,
      render: (m) => (
        <Box
          component="span"
          title={m.file_path ?? ""}
          sx={{
            display: "inline-block",
            maxWidth: 420,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "bottom",
          }}
        >
          {m.file_path ?? "—"}
        </Box>
      ),
    },
    {
      id: "actions",
      label: "",
      width: "180px",
      align: "right",
      render: (m) => (
        <AdminButton
          variant="secondary"
          icon={<Search size={14} />}
          onClick={() => openPicker(m)}
        >
          {t("admin.reviews.findOnTmdb")}
        </AdminButton>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.review")]}
        title={t("admin.reviews.title")}
        subtitle={t("admin.reviews.subtitle")}
      />

      <AdminTable
        columns={columns}
        rows={paged.items}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.reviews.loadError") : undefined}
        onRetry={() => void refetch()}
        emptyState={
          <AdminEmptyState
            icon={AlertCircle}
            title={t("admin.reviews.empty")}
            body={t("admin.reviews.emptyHint")}
          />
        }
      />

      {allMovies.length > pageSize && (
        <AdminTablePagination
          pageNumber={paged.pageNumber}
          canGoNext={paged.canGoNext}
          canGoPrevious={paged.canGoPrevious}
          onNext={paged.goNext}
          onPrevious={paged.goPrevious}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
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
        busy={relink.isPending || promote.isPending}
      />

      <PromoteToSeriesConfirmDialog
        open={!!pendingPromotion}
        movieLabel={activeMovie ? `${activeMovie.title} (${activeMovie.year})` : ""}
        pick={pendingPromotion}
        busy={promote.isPending}
        errorMessage={promoteError}
        onCancel={closePromote}
        onConfirm={confirmPromote}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              bgcolor:
                snack.severity === "success"
                  ? "rgba(80,180,120,0.15)"
                  : snack.severity === "error"
                    ? "rgba(220,80,70,0.18)"
                    : "rgba(240,180,80,0.15)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}
