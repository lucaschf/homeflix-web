import { Box, IconButton, Snackbar, Stack, Tooltip, Typography } from "@mui/material";
import { Eye, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  useAdminMovies,
  useDeleteMovie,
  useEnrichMovie,
  useLibraries,
  type AdminMoviesFilters,
} from "../../api/hooks";
import type { MovieSummary } from "../../api/types";
import { ApiError } from "../../api/client";
import {
  AdminBadge,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  AdminToolbar,
  FilterChip,
  type AdminTableColumn,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Snack = { message: string; severity: "success" | "error" | "warning" } | null;

type EnrichmentFilterValue = "all" | "yes" | "no";
type ReviewFilterValue = "all" | "flagged";

const ENRICHMENT_OPTIONS: { label: string; value: EnrichmentFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Enriched", value: "yes" },
  { label: "Not enriched", value: "no" },
];

const REVIEW_OPTIONS: { label: string; value: ReviewFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Flagged", value: "flagged" },
];

/**
 * Admin Catalog · Movies. Operator-facing list of every movie the
 * caller's profile is allowed to see, with filters for library /
 * enrichment status / review queue and per-row actions
 * (open detail, re-enrich, soft-delete).
 *
 * Pagination uses explicit Previous / Next buttons backed by
 * ``usePagedInfiniteQuery`` — the operator navigates page-by-
 * page rather than hitting an infinite-scroll sentinel.
 */
export function MoviesAdmin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.catalog.movies.title"));

  const [libraryFilter, setLibraryFilter] = useState<string>("");
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentFilterValue>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilterValue>("all");
  const [pageSize, setPageSize] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<MovieSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  const filters: AdminMoviesFilters = useMemo(() => {
    const f: AdminMoviesFilters = {};
    if (libraryFilter) f.libraryId = libraryFilter;
    if (enrichmentFilter !== "all") f.hasTmdbId = enrichmentFilter === "yes";
    if (reviewFilter !== "all") f.needsReview = true;
    return f;
  }, [libraryFilter, enrichmentFilter, reviewFilter]);

  const moviesQuery = useAdminMovies(filters, { pageSize });
  const {
    items,
    pageNumber,
    canGoNext,
    canGoPrevious,
    goNext,
    goPrevious,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = moviesQuery;
  const { data: libraries } = useLibraries();
  const enrich = useEnrichMovie();
  const remove = useDeleteMovie();

  const libraryNameById = useMemo<Record<string, string>>(() => {
    if (!libraries) return {};
    return Object.fromEntries(libraries.map((l) => [l.id, l.name]));
  }, [libraries]);

  const libraryOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t("admin.catalog.filter.all"), value: "" },
    ];
    if (libraries) {
      for (const lib of libraries) opts.push({ label: lib.name, value: lib.id });
    }
    return opts;
  }, [libraries, t]);

  const handleEnrich = async (movie: MovieSummary, force: boolean) => {
    try {
      await enrich.mutateAsync({ movieId: movie.id, force });
      setSnack({
        message: t("admin.catalog.snack.enrichSuccess", { title: movie.title }),
        severity: "success",
      });
      void refetch();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("admin.catalog.snack.enrichFailed");
      setSnack({ message, severity: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(pendingDelete.id);
      setSnack({
        message: t("admin.catalog.snack.deleteSuccess", { title: pendingDelete.title }),
        severity: "success",
      });
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("admin.catalog.snack.deleteFailed"),
      );
    }
  };

  const columns: AdminTableColumn<MovieSummary>[] = [
    {
      id: "poster",
      label: "",
      width: "44px",
      render: (m) => <PosterCell url={m.poster_path} title={m.title} />,
    },
    {
      id: "title",
      label: t("admin.catalog.col.title"),
      render: (m) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            component={RouterLink}
            to={`/movie/${m.id}`}
            sx={{
              color: "text.primary",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              "&:hover": { color: "primary.main" },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {m.title}
          </Typography>
          {m.needs_enrichment_review && (
            <AdminBadge tone="peach">{t("admin.catalog.badge.review")}</AdminBadge>
          )}
        </Stack>
      ),
    },
    { id: "year", label: t("admin.catalog.col.year"), width: "80px", mono: true, muted: true },
    {
      id: "library",
      label: t("admin.catalog.col.library"),
      width: "150px",
      muted: true,
      render: (m) => libraryNameById[m.library_id] ?? m.library_id,
    },
    {
      id: "tmdb",
      label: t("admin.catalog.col.tmdb"),
      width: "120px",
      mono: true,
      render: (m) =>
        m.tmdb_id ? (
          `tmdb/${m.tmdb_id}`
        ) : (
          <Typography component="span" sx={{ color: "#ff8a7a", fontFamily: "inherit" }}>
            —
          </Typography>
        ),
    },
    {
      id: "resolution",
      label: t("admin.catalog.col.resolution"),
      width: "110px",
      mono: true,
      muted: true,
      render: (m) => m.resolution ?? "—",
    },
    {
      id: "actions",
      label: "",
      width: "120px",
      align: "right",
      render: (m) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title={t("admin.catalog.action.open")}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/movie/${m.id}`);
              }}
              sx={{ color: "text.secondary" }}
            >
              <Eye size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("admin.catalog.action.reenrich")}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                void handleEnrich(m, true);
              }}
              disabled={enrich.isPending}
              sx={{ color: "text.secondary" }}
            >
              <Sparkles size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("admin.catalog.action.delete")}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(m);
                setDeleteError(null);
              }}
              sx={{ color: "#ff8a7a" }}
            >
              <Trash2 size={15} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.movies")]}
        title={t("admin.catalog.movies.title")}
        subtitle={t("admin.catalog.movies.subtitle")}
        toolbar={
          <AdminToolbar>
            <FilterChip
              label={t("admin.catalog.filter.library")}
              value={libraryFilter}
              options={libraryOptions}
              onChange={setLibraryFilter}
            />
            <FilterChip
              label={t("admin.catalog.filter.tmdb")}
              value={enrichmentFilter}
              options={ENRICHMENT_OPTIONS.map((o) => ({
                label: t(`admin.catalog.filter.tmdbOption.${o.value}`),
                value: o.value,
              }))}
              onChange={setEnrichmentFilter}
            />
            <FilterChip
              label={t("admin.catalog.filter.review")}
              value={reviewFilter}
              options={REVIEW_OPTIONS.map((o) => ({
                label: t(`admin.catalog.filter.reviewOption.${o.value}`),
                value: o.value,
              }))}
              onChange={setReviewFilter}
            />
          </AdminToolbar>
        }
      />

      <AdminTable
        columns={columns}
        rows={items}
        rowKey="id"
        loading={isLoading}
        error={isError ? t("admin.catalog.errorLoading") : undefined}
        onRetry={() => void refetch()}
        emptyState={
          <AdminEmptyState
            title={t("admin.catalog.movies.emptyTitle")}
            body={t("admin.catalog.movies.emptyBody")}
          />
        }
      />

      {(items.length > 0 || canGoPrevious) && (
        <AdminTablePagination
          pageNumber={pageNumber}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          onNext={goNext}
          onPrevious={goPrevious}
          isFetching={isFetching}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      )}

      <AdminConfirmDialog
        open={!!pendingDelete}
        title={t("admin.catalog.delete.title", { title: pendingDelete?.title ?? "" })}
        body={t("admin.catalog.delete.body")}
        consequences={[
          t("admin.catalog.delete.consequenceCatalog"),
          t("admin.catalog.delete.consequenceFile"),
          t("admin.catalog.delete.consequenceRefs"),
        ]}
        danger
        busy={remove.isPending}
        errorMessage={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
        confirmLabel={t("admin.catalog.delete.confirm")}
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
            // The locale subtitle is unused here — the i18n object
            // is referenced to keep the import tied to the value
            // even if a future linter changes its mind. Keeps the
            // bundle stable across locale switches because
            // ``i18n.language`` change triggers a re-render.
            data-locale={i18n.language}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}

function PosterCell({ url, title }: { url: string | null; title: string }) {
  return (
    <Box
      sx={{
        width: 32,
        height: 48,
        borderRadius: 0.5,
        bgcolor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={title}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </Box>
  );
}
