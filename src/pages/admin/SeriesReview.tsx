import { useState } from "react";
import { Box, Snackbar, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Check, ScanLine, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { usePagedList, useRelinkSeries, useSeriesNeedingReview } from "../../api/hooks";
import type { NeedsReviewSeries, TmdbSuggestion } from "../../api/types";
import {
  AdminButton,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  FancyEmpty,
  type AdminTableColumn,
} from "../../components/admin";
import { SeriesTmdbSuggestionsDialog } from "../../components/admin/SeriesTmdbSuggestionsDialog";
import { ReviewTabs } from "./components/ReviewTabs";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { status, whiteAlpha } from "../../theme/tokens";

type Snack = { message: string; severity: "success" | "error" | "warning" } | null;

export function SeriesReview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.seriesReviews.title"));

  const { data: series, isLoading, isError, refetch } = useSeriesNeedingReview();
  const relink = useRelinkSeries();

  const [pageSize, setPageSize] = useState(10);
  const allSeries = series ?? [];
  const paged = usePagedList<NeedsReviewSeries>(allSeries, pageSize);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSeries, setActiveSeries] = useState<NeedsReviewSeries | null>(null);
  const [dialogWarning, setDialogWarning] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const openPicker = (s: NeedsReviewSeries) => {
    setActiveSeries(s);
    setDialogWarning(null);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setDialogWarning(null);
  };

  const onSuggestionSelected = async (suggestion: TmdbSuggestion) => {
    if (!activeSeries) return;
    setDialogWarning(null);
    try {
      const result = await relink.mutateAsync({
        seriesId: activeSeries.id,
        tmdb_id: suggestion.tmdb_id,
        media_type: "tv",
      });
      if (result.enriched) {
        setSnack({
          message: t("admin.seriesReviews.snack.success", { title: activeSeries.title }),
          severity: "success",
        });
        closePicker();
      } else {
        // Backend completed the call but enrichment failed — keep the
        // dialog open so the admin can try another candidate.
        setDialogWarning(result.error ?? t("admin.seriesReviews.snack.enrichmentFailed"));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("admin.seriesReviews.snack.relinkFailed");
      setDialogWarning(message);
    }
  };

  const columns: AdminTableColumn<NeedsReviewSeries>[] = [
    {
      id: "title",
      label: t("admin.seriesReviews.table.title"),
      render: (s) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {s.title}
        </Typography>
      ),
    },
    {
      id: "year",
      label: t("admin.seriesReviews.table.year"),
      width: "90px",
      mono: true,
      muted: true,
      render: (s) => s.year,
    },
    {
      id: "tmdb_id",
      label: t("admin.seriesReviews.table.tmdbId"),
      mono: true,
      muted: true,
      render: (s) => (s.tmdb_id ? `tmdb/tv/${s.tmdb_id}` : "—"),
    },
    {
      id: "actions",
      label: "",
      width: "180px",
      align: "right",
      render: (s) => (
        <AdminButton variant="secondary" icon={<Search size={14} />} onClick={() => openPicker(s)}>
          {t("admin.seriesReviews.findOnTmdb")}
        </AdminButton>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.review")]}
        title={t("admin.seriesReviews.title")}
        subtitle={t("admin.seriesReviews.subtitle")}
        toolbar={<ReviewTabs />}
      />

      <AdminTable
        columns={columns}
        rows={paged.items}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.seriesReviews.loadError") : undefined}
        onRetry={() => void refetch()}
        emptyState={
          <FancyEmpty
            icon={Check}
            motif="cards"
            title={t("admin.seriesReviews.empty")}
            body={t("admin.seriesReviews.emptyHint")}
            badge={t("admin.seriesReviews.emptyBadge")}
            primary={
              <AdminButton
                variant="primary"
                icon={<ScanLine size={14} />}
                onClick={() => navigate("/admin/scan")}
              >
                {t("admin.seriesReviews.emptyCta")}
              </AdminButton>
            }
          />
        }
      />

      {allSeries.length > pageSize && (
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

      <SeriesTmdbSuggestionsDialog
        open={pickerOpen}
        seriesId={activeSeries?.id ?? null}
        seriesLabel={activeSeries ? `${activeSeries.title} (${activeSeries.year})` : ""}
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
          <Box
            sx={{
              bgcolor:
                snack.severity === "success"
                  ? alpha(status.ok.base, 0.15)
                  : snack.severity === "error"
                    ? alpha(status.err.base, 0.18)
                    : alpha(status.warn.base, 0.15),
              border: `1px solid ${whiteAlpha(0.08)}`,
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
