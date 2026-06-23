import { Box, ButtonBase, CircularProgress, Link, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AlertTriangle, ChevronRight, Film, HardDrive, ScanLine, Tv, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useAdminOverviewStats,
  useMoviesNeedingReview,
  useReadiness,
} from "../../api/hooks";
import type { AdminOverviewStats, NeedsReviewMovie } from "../../api/types";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  type BadgeTone,
  StatCard,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { inkAlpha, peachAlpha, status as statusTone, whiteAlpha } from "../../theme/tokens";
import { parseServerTime } from "../../utils/datetime";

type TFn = (key: string, vars?: Record<string, unknown>) => string;

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function formatBytesShort(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * Project the last-scan card's headline value: either a
 * relative timestamp ("2h ago") or a dash when no scan has
 * ever run.
 */
function formatLastScanValue(
  scan: AdminOverviewStats["last_scan"],
  locale: string,
  t: TFn,
): string {
  if (!scan) return t("admin.overview.lastScan.never");
  const reference = scan.finished_at ?? scan.started_at;
  const diffMs = Date.now() - parseServerTime(reference);
  const seconds = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return rtf.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/**
 * Sub label for the last-scan card: status word when the row is
 * available, generic copy otherwise.
 */
function formatLastScanSub(
  scan: AdminOverviewStats["last_scan"],
  t: TFn,
): string {
  if (!scan) return t("admin.overview.lastScan.neverSub");
  return t(`admin.overview.lastScan.status.${scan.status}`);
}

/**
 * HLS cache value renders the raw bytes-on-disk; the sub shows
 * the occupancy ratio. ``"—"`` when stats haven't loaded yet.
 */
function formatHlsValue(cache: AdminOverviewStats["hls_cache"] | undefined): string {
  if (!cache) return "—";
  return formatBytesShort(cache.size_bytes);
}

function formatHlsSub(
  cache: AdminOverviewStats["hls_cache"] | undefined,
  t: TFn,
): string {
  if (!cache || cache.max_bytes <= 0) return t("admin.overview.hlsCache.sub");
  const percent = Math.round((cache.size_bytes / cache.max_bytes) * 100);
  return t("admin.overview.hlsCache.subWithRatio", {
    percent,
    cap: formatBytesShort(cache.max_bytes),
  });
}

/**
 * Admin Overview dashboard.
 *
 * Six headline stat cards (movies / series / users / review queue
 * / last scan / HLS cache) all driven by a single
 * ``useAdminOverviewStats`` round-trip so the page settles in
 * one loading transition rather than flickering through each
 * card's own request.
 *
 * The needs-review queue still uses its own hook for the
 * "Recently flagged" panel below — the aggregated stats only
 * surface the count, not the row payload.
 */
export function AdminOverview() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.overview.title"));

  const stats = useAdminOverviewStats();
  const reviewQueue = useMoviesNeedingReview();
  const reviewCount = stats.data?.review_count ?? reviewQueue.data?.length ?? 0;
  const statsLoading = stats.isLoading;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.overview")]}
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          gap: 2.25,
          mb: 3.5,
        }}
      >
        <StatCard
          label={t("admin.overview.stats.movies")}
          value={stats.data?.movies_count ?? "—"}
          sub={t("admin.overview.stats.moviesSub")}
          icon={Film}
          loading={statsLoading}
          onClick={() => navigate("/admin/catalog/movies")}
        />
        <StatCard
          label={t("admin.overview.stats.series")}
          value={stats.data?.series_count ?? "—"}
          sub={t("admin.overview.stats.seriesSub")}
          icon={Tv}
          loading={statsLoading}
          onClick={() => navigate("/admin/catalog/series")}
        />
        <StatCard
          label={t("admin.overview.stats.review")}
          value={reviewCount}
          sub={t("admin.overview.reviewSub")}
          icon={AlertTriangle}
          alert={reviewCount > 0}
          loading={statsLoading && reviewQueue.isLoading}
          onClick={() => navigate("/admin/catalog/review")}
        />
        <StatCard
          label={t("admin.overview.stats.lastScan")}
          value={formatLastScanValue(stats.data?.last_scan ?? null, i18n.language, t)}
          sub={formatLastScanSub(stats.data?.last_scan ?? null, t)}
          icon={ScanLine}
          loading={statsLoading}
          onClick={() => navigate("/admin/scan")}
        />
        <StatCard
          label={t("admin.overview.stats.users")}
          value={stats.data?.users_count ?? "—"}
          sub={t("admin.overview.stats.usersSub")}
          icon={Users}
          loading={statsLoading}
          onClick={() => navigate("/admin/users")}
        />
        <StatCard
          label={t("admin.overview.stats.hlsCache")}
          value={formatHlsValue(stats.data?.hls_cache)}
          sub={formatHlsSub(stats.data?.hls_cache, t)}
          icon={HardDrive}
          loading={statsLoading}
          onClick={() => navigate("/admin/system/hls-cache")}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <RecentlyFlaggedPanel
          movies={reviewQueue.data}
          loading={reviewQueue.isLoading}
          onSeeAll={() => navigate("/admin/catalog/review")}
        />
        <SystemHealthPanel />
      </Box>
    </>
  );
}

const RECENTLY_FLAGGED_LIMIT = 5;

/**
 * Top-of-queue summary on the Overview dashboard.
 *
 * Renders up to ``RECENTLY_FLAGGED_LIMIT`` rows from the
 * needs-review queue so the operator sees what's pending without
 * leaving the dashboard. Each row click jumps to the full queue at
 * ``/admin/catalog/review`` where the relink + promote flows live.
 *
 * "Reason" / "detected at" badges from the design spec aren't
 * here yet — both require backend DTO additions (the existing
 * payload only carries id / title / year / file_path). The card
 * lands now with what we have; richer fields plug in when the
 * backend grows them.
 */
function RecentlyFlaggedPanel({
  movies,
  loading,
  onSeeAll,
}: {
  movies: NeedsReviewMovie[] | undefined;
  loading: boolean;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  const shown = (movies ?? []).slice(0, RECENTLY_FLAGGED_LIMIT);
  const totalCount = movies?.length ?? 0;
  const hasMore = totalCount > RECENTLY_FLAGGED_LIMIT;

  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.recentlyFlagged.title")}
        subtitle={t("admin.overview.recentlyFlagged.subtitle")}
        action={
          totalCount > 0 ? (
            <Link
              component="button"
              onClick={onSeeAll}
              variant="control"
              underline="hover"
            >
              {t("admin.overview.recentlyFlagged.seeAll", { count: totalCount })}
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      ) : shown.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("admin.overview.recentlyFlagged.empty")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {shown.map((movie) => (
            <FlaggedRow key={movie.id} movie={movie} onClick={onSeeAll} />
          ))}
          {hasMore && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ pt: 1, pl: 6.5, fontSize: "0.78125rem" }}
            >
              {t("admin.overview.recentlyFlagged.moreCount", {
                count: totalCount - RECENTLY_FLAGGED_LIMIT,
              })}
            </Typography>
          )}
        </Box>
      )}
    </AdminCard>
  );
}

function FlaggedRow({
  movie,
  onClick,
}: {
  movie: NeedsReviewMovie;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "left",
        width: "100%",
        gap: 1.75,
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        border: "1px solid transparent",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": {
          bgcolor: whiteAlpha(0.025),
          borderColor: whiteAlpha(0.08),
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: peachAlpha(0.1),
          border: `1px solid ${peachAlpha(0.3)}`,
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={17} aria-hidden />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.25,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" fontWeight={500} noWrap sx={{ minWidth: 0 }}>
            {movie.title}
          </Typography>
          <Typography variant="metaMono" color="text.secondary">
            {movie.year}
          </Typography>
          <AdminBadge tone="peach">
            {t("admin.overview.recentlyFlagged.reason")}
          </AdminBadge>
        </Box>
        <Typography
          variant="metaMono"
          color="text.secondary"
          sx={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {movie.file_path ?? t("admin.overview.recentlyFlagged.noFilePath")}
        </Typography>
      </Box>
      <Box sx={{ color: "text.secondary", display: "flex", flexShrink: 0 }}>
        <ChevronRight size={16} aria-hidden />
      </Box>
    </ButtonBase>
  );
}

/**
 * Tones the standard backend health vocabulary into the badge
 * palette. Anything unknown defaults to ``warn`` so a future
 * status the UI hasn't been taught yet shows up as something to
 * eyeball rather than being silently treated as healthy.
 */
const HEALTH_TONE_BY_STATUS: Record<string, BadgeTone> = {
  healthy: "ok",
  ready: "ok",
  ok: "ok",
  up: "ok",
  degraded: "warn",
  warning: "warn",
  unknown: "warn",
  not_ready: "err",
  unhealthy: "err",
  down: "err",
  failed: "err",
  error: "err",
};

function toneFor(status: string): BadgeTone {
  return HEALTH_TONE_BY_STATUS[status.toLowerCase()] ?? "warn";
}

/**
 * Compact per-component health view at the bottom of the
 * Overview. Polls ``/health/ready`` every 30 s (handled by the
 * hook) and renders one row per backing dependency the backend
 * reports.
 */
function SystemHealthPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isError, dataUpdatedAt } = useReadiness();
  // Absolute clock time of the last successful poll. Using the
  // browser's locale-aware time formatter keeps the affordance
  // pure-render — "X seconds ago" would force a tick interval
  // that conflicts with react-hooks/purity and adds re-renders
  // for an admin row that doesn't need them.
  const lastCheckedAt =
    dataUpdatedAt && data
      ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.systemHealth.title")}
        subtitle={
          lastCheckedAt
            ? t("admin.overview.systemHealth.lastChecked", { at: lastCheckedAt })
            : t("admin.overview.systemHealth.subtitle")
        }
      />

      {isLoading && !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      ) : isError || !data ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography variant="body2" color="error">
            {t("admin.overview.systemHealth.error")}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: 1.5,
          }}
        >
          <HealthRow
            label={t("admin.overview.systemHealth.overall")}
            status={data.status}
          />
          {Object.entries(data.checks ?? {}).map(([name, status]) => (
            <HealthRow key={name} label={name} status={status} />
          ))}
        </Box>
      )}
    </AdminCard>
  );
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const tone = toneFor(status);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        border: `1px solid ${whiteAlpha(0.06)}`,
        borderRadius: 1,
        bgcolor: whiteAlpha(0.015),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            bgcolor:
              tone === "ok"
                ? statusTone.ok.fg
                : tone === "warn"
                  ? statusTone.warn.fg
                  : tone === "err"
                    ? statusTone.err.fg
                    : inkAlpha(0.5),
            boxShadow:
              tone === "ok"
                ? `0 0 0 3px ${alpha(statusTone.ok.base, 0.18)}`
                : tone === "warn"
                  ? `0 0 0 3px ${alpha(statusTone.warn.base, 0.18)}`
                  : tone === "err"
                    ? `0 0 0 3px ${alpha(statusTone.err.base, 0.18)}`
                    : "none",
          }}
        />
        <Typography
          variant="control"
          sx={{
            textTransform: "capitalize",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>
      <AdminBadge tone={tone}>{status}</AdminBadge>
    </Box>
  );
}

