import { Box, IconButton, Snackbar, Stack, Tooltip, Typography } from "@mui/material";
import { Eye, ScanLine, Sparkles, Trash2, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  useAdminSeries,
  useDeleteSeries,
  useEnrichSeries,
  useLibraries,
  type AdminSeriesFilters,
} from "../../api/hooks";
import type { SeriesSummary } from "../../api/types";
import { ApiError } from "../../api/client";
import {
  AdminButton,
  AdminConfirmDialog,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  AdminToolbar,
  FancyEmpty,
  FilterChip,
  ToolbarSearch,
  type AdminTableColumn,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { accentCoral, whiteAlpha, toastSurfaceSx } from "../../theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

type Snack = { message: string; severity: "success" | "error" | "warning" } | null;
type EnrichmentFilterValue = "all" | "yes" | "no";

const ENRICHMENT_OPTIONS: { value: EnrichmentFilterValue }[] = [
  { value: "all" },
  { value: "yes" },
  { value: "no" },
];

/**
 * Admin Catalog · Series. Mirrors ``MoviesAdmin`` but drops the
 * "needs review" filter (series don't carry the flag yet) and
 * swaps "Resolution" for an "Episodes" count column. Per-row
 * actions (open detail, re-enrich, soft-delete) use the same
 * shortcuts.
 */
export function SeriesAdmin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.catalog.series.title"));

  const [libraryFilter, setLibraryFilter] = useState<string>("");
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentFilterValue>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<SeriesSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: AdminSeriesFilters = useMemo(() => {
    const f: AdminSeriesFilters = {};
    if (libraryFilter) f.libraryId = libraryFilter;
    if (enrichmentFilter !== "all") f.hasTmdbId = enrichmentFilter === "yes";
    const trimmedQ = debouncedSearch.trim();
    if (trimmedQ) f.q = trimmedQ;
    return f;
  }, [libraryFilter, enrichmentFilter, debouncedSearch]);

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
  } = useAdminSeries(filters, { pageSize });
  const { data: libraries } = useLibraries();
  const enrich = useEnrichSeries();
  const remove = useDeleteSeries();

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

  const handleEnrich = async (series: SeriesSummary, force: boolean) => {
    try {
      await enrich.mutateAsync({ seriesId: series.id, force });
      setSnack({
        message: t("admin.catalog.snack.enrichSuccess", { title: series.title }),
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

  const columns: AdminTableColumn<SeriesSummary>[] = [
    {
      id: "poster",
      label: "",
      width: "44px",
      render: (s) => (
        <Box
          sx={{
            width: 32,
            height: 48,
            borderRadius: 0.5,
            bgcolor: whiteAlpha(0.04),
            border: `1px solid ${whiteAlpha(0.06)}`,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {s.poster_path && (
            <Box
              component="img"
              src={s.poster_path}
              alt={s.title}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </Box>
      ),
    },
    {
      id: "title",
      label: t("admin.catalog.col.title"),
      render: (s) => (
        <Typography
          component={RouterLink}
          to={`/series/${s.id}`}
          sx={{
            color: "text.primary",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            "&:hover": { color: "primary.main" },
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {s.title}
        </Typography>
      ),
    },
    {
      id: "year",
      label: t("admin.catalog.col.year"),
      width: "110px",
      mono: true,
      muted: true,
      render: (s) =>
        s.end_year && s.end_year !== s.start_year
          ? `${s.start_year}–${s.end_year}`
          : String(s.start_year),
    },
    {
      id: "library",
      label: t("admin.catalog.col.library"),
      width: "150px",
      muted: true,
      render: (s) => libraryNameById[s.library_id] ?? s.library_id,
    },
    {
      id: "tmdb",
      label: t("admin.catalog.col.tmdb"),
      width: "120px",
      mono: true,
      render: (s) =>
        s.tmdb_id ? (
          `tmdb/${s.tmdb_id}`
        ) : (
          <Typography component="span" sx={{ color: accentCoral, fontFamily: "inherit" }}>
            —
          </Typography>
        ),
    },
    {
      id: "episodes",
      label: t("admin.catalog.col.episodes"),
      width: "110px",
      mono: true,
      muted: true,
      render: (s) => t("admin.catalog.episodesCount", { count: s.total_episodes }),
    },
    {
      id: "actions",
      label: "",
      width: "120px",
      align: "right",
      render: (s) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title={t("admin.catalog.action.open")}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/series/${s.id}`);
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
                void handleEnrich(s, true);
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
                setPendingDelete(s);
                setDeleteError(null);
              }}
              sx={{ color: accentCoral }}
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
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.series")]}
        title={t("admin.catalog.series.title")}
        subtitle={t("admin.catalog.series.subtitle")}
        toolbar={
          <AdminToolbar>
            <ToolbarSearch
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t("admin.catalog.filter.searchPlaceholder")}
            />
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
          <FancyEmpty
            icon={Tv}
            motif="cards"
            title={t("admin.catalog.series.emptyTitle")}
            body={t("admin.catalog.series.emptyBody")}
            primary={
              <AdminButton
                variant="primary"
                icon={<ScanLine size={14} />}
                onClick={() => navigate("/admin/scan")}
              >
                {t("admin.catalog.series.emptyCta")}
              </AdminButton>
            }
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
              ...toastSurfaceSx(snack.severity),
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
            data-locale={i18n.language}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}
