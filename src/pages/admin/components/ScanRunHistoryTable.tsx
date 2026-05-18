import { Box, Tooltip, Typography } from "@mui/material";
import { Inbox } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  AdminScanRun,
  AdminScanRunKind,
  AdminScanRunStatus,
} from "../../../api/types";
import {
  AdminBadge,
  AdminEmptyState,
  AdminTable,
  type AdminTableColumn,
  type BadgeTone,
} from "../../../components/admin";

const STATUS_TONE: Record<AdminScanRunStatus, BadgeTone> = {
  running: "info",
  succeeded: "ok",
  failed: "err",
  interrupted: "warn",
};

function formatDuration(started: string, finished: string | null): string {
  if (!finished) return "—";
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m${remainder}s`;
}

function formatSummary(run: AdminScanRun, t: (k: string) => string): string {
  const s = run.summary ?? {};
  if (run.kind === "scan") {
    const movies = (s.movies_created ?? 0) + (s.movies_updated ?? 0);
    const eps = (s.episodes_created ?? 0) + (s.episodes_updated ?? 0);
    if (movies === 0 && eps === 0) return t("admin.history.summary.nothingNew");
    const parts: string[] = [];
    if (movies > 0) parts.push(`${movies} ${t("admin.history.summary.movies")}`);
    if (eps > 0) parts.push(`${eps} ${t("admin.history.summary.episodes")}`);
    return parts.join(" · ");
  }
  // enrich
  const enriched = (s.movies_enriched ?? 0) + (s.series_enriched ?? 0);
  const skipped = s.skipped ?? 0;
  if (enriched === 0 && skipped === 0) return t("admin.history.summary.nothingNew");
  const parts: string[] = [];
  if (enriched > 0)
    parts.push(`${enriched} ${t("admin.history.summary.enriched")}`);
  if (skipped > 0) parts.push(`${skipped} ${t("admin.history.summary.skipped")}`);
  return parts.join(" · ");
}

interface ScanRunHistoryTableProps {
  runs: AdminScanRun[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  kind: AdminScanRunKind;
}

/**
 * Shared history table for ``/admin/scan`` and ``/admin/enrich``.
 * Columns: started · status · trigger · summary · duration · errors.
 * The ``kind`` prop only changes the empty state copy and the
 * summary serializer; the column layout is intentionally identical
 * so the operator builds one mental model.
 */
export function ScanRunHistoryTable({
  runs,
  isLoading,
  isError,
  onRetry,
  kind,
}: ScanRunHistoryTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<AdminTableColumn<AdminScanRun>[]>(
    () => [
      {
        id: "started_at",
        label: t("admin.history.col.started"),
        width: "180px",
        render: (r) => (
          <Box>
            <Typography variant="body2">
              {new Date(r.started_at).toLocaleString()}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              {r.id}
            </Typography>
          </Box>
        ),
      },
      {
        id: "status",
        label: t("admin.history.col.status"),
        width: "130px",
        render: (r) => (
          <AdminBadge tone={STATUS_TONE[r.status]}>
            {t(`admin.history.status.${r.status}`)}
          </AdminBadge>
        ),
      },
      {
        id: "trigger",
        label: t("admin.history.col.trigger"),
        width: "120px",
        render: (r) => (
          <AdminBadge tone={r.trigger === "manual" ? "peach" : "neutral"}>
            {t(`admin.history.trigger.${r.trigger}`)}
          </AdminBadge>
        ),
      },
      {
        id: "summary",
        label: t("admin.history.col.summary"),
        render: (r) => (
          <Typography variant="body2" sx={{ color: "text.primary" }}>
            {formatSummary(r, t)}
          </Typography>
        ),
      },
      {
        id: "duration",
        label: t("admin.history.col.duration"),
        width: "100px",
        muted: true,
        render: (r) => formatDuration(r.started_at, r.finished_at),
      },
      {
        id: "errors",
        label: t("admin.history.col.errors"),
        width: "120px",
        align: "right",
        render: (r) =>
          r.errors_count === 0 ? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ) : (
            <Tooltip
              title={r.errors.slice(0, 5).join("\n") || ""}
              placement="left"
              componentsProps={{
                tooltip: {
                  sx: {
                    whiteSpace: "pre-wrap",
                    maxWidth: 480,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: "0.6875rem",
                  },
                },
              }}
            >
              <Box sx={{ display: "inline-flex" }}>
                <AdminBadge tone="err">{r.errors_count}</AdminBadge>
              </Box>
            </Tooltip>
          ),
      },
    ],
    [t],
  );

  return (
    <AdminTable
      columns={columns}
      rows={runs}
      rowKey="id"
      loading={isLoading}
      error={isError ? t("admin.history.errorLoading") : undefined}
      onRetry={onRetry}
      emptyState={
        <AdminEmptyState
          icon={Inbox}
          title={
            kind === "scan"
              ? t("admin.scan.history.emptyTitle")
              : t("admin.enrich.history.emptyTitle")
          }
          body={
            kind === "scan"
              ? t("admin.scan.history.emptyBody")
              : t("admin.enrich.history.emptyBody")
          }
        />
      }
    />
  );
}

