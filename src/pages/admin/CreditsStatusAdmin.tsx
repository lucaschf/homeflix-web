import { Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCreditsStatus } from "../../api/hooks";
import type { CreditsStatusItem } from "../../api/types";
import {
  AdminBadge,
  type AdminTableColumn,
  AdminPageHeader,
  AdminTable,
  AdminTablePagination,
  AdminToolbar,
  type BadgeTone,
  FilterChip,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type MediaType = "movie" | "episode";

const STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_CREDITS_FOUND",
  "FAILED",
  "DISABLED",
] as const;

function stateTone(state: string): BadgeTone {
  switch (state) {
    case "COMPLETED":
      return "ok";
    case "FAILED":
      return "err";
    case "IN_PROGRESS":
      return "info";
    default:
      return "neutral";
  }
}

function mmss(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Admin observability for per-file credits detection — lists movies /
 * episodes by detection state with per-state counts, and deep-links each
 * row into its manual editor so an operator can fix misses.
 */
export function CreditsStatusAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.credits.status.title"));

  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [state, setState] = useState<string>("all");
  const [pageSize, setPageSize] = useState(10);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, refetch, isFetching } = useCreditsStatus({
    mediaType,
    state: state === "all" ? null : state,
    limit: pageSize,
    offset,
  });

  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;

  const stateLabel = (s: string) => t(`admin.credits.status.states.${s}`);
  const stateOptions = [
    { label: t("admin.credits.status.allStates"), value: "all" },
    ...STATES.map((s) => ({
      label: `${stateLabel(s)} (${counts[s] ?? 0})`,
      value: s,
    })),
  ];

  const reset = (fn: () => void) => {
    fn();
    setOffset(0);
  };

  const columns: AdminTableColumn<CreditsStatusItem>[] = [
    { id: "title", label: t("admin.credits.status.columns.title"), wrap: true },
    {
      id: "state",
      label: t("admin.credits.status.columns.state"),
      width: 160,
      render: (row) => <AdminBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</AdminBadge>,
    },
    {
      id: "onset",
      label: t("admin.credits.status.columns.onset"),
      width: 90,
      mono: true,
      render: (row) => mmss(row.start_seconds),
    },
    {
      id: "source",
      label: t("admin.credits.status.columns.source"),
      width: 100,
      render: (row) =>
        row.source
          ? t(`admin.credits.source.${row.source === "MANUAL" ? "manual" : "auto"}`)
          : "—",
    },
    {
      id: "confidence",
      label: t("admin.credits.status.columns.confidence"),
      width: 110,
      mono: true,
      align: "right",
      render: (row) => (row.confidence == null ? "—" : `${Math.round(row.confidence * 100)}%`),
    },
  ];

  const openEditor = (row: CreditsStatusItem) => {
    if (row.media_type === "movie") {
      navigate(`/movie/${row.media_id}`);
    } else if (row.series_id != null && row.season_number != null && row.episode_number != null) {
      navigate(`/admin/intros/${row.series_id}/${row.season_number}/${row.episode_number}`);
    }
  };

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.group.catalog"), t("admin.nav.credits")]}
        title={t("admin.credits.status.title")}
        subtitle={t("admin.credits.status.subtitle")}
      />

      <AdminToolbar>
        <FilterChip<MediaType>
          label={t("admin.credits.status.type.label")}
          value={mediaType}
          onChange={(v) => reset(() => setMediaType(v))}
          options={[
            { label: t("admin.credits.status.type.movie"), value: "movie" },
            { label: t("admin.credits.status.type.episode"), value: "episode" },
          ]}
        />
        <FilterChip<string>
          label={t("admin.credits.status.columns.state")}
          value={state}
          onChange={(v) => reset(() => setState(v))}
          options={stateOptions}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", alignSelf: "center" }}>
          {t("admin.credits.status.totalLabel", { count: total })}
        </Typography>
      </AdminToolbar>

      <AdminTable<CreditsStatusItem>
        columns={columns}
        rows={data?.items}
        rowKey="media_id"
        loading={isLoading}
        error={isError ? t("admin.credits.status.loadError") : undefined}
        onRetry={() => void refetch()}
        onRowClick={openEditor}
      />

      <AdminTablePagination
        pageNumber={Math.floor(offset / pageSize) + 1}
        canGoPrevious={offset > 0}
        canGoNext={offset + pageSize < total}
        onPrevious={() => setOffset((o) => Math.max(0, o - pageSize))}
        onNext={() => setOffset((o) => o + pageSize)}
        isFetching={isFetching}
        pageSize={pageSize}
        onPageSizeChange={(size) => reset(() => setPageSize(size))}
      />
    </>
  );
}
