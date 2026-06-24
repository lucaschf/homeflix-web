import { Box, ButtonBase, CircularProgress, Link, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Film,
  HardDrive,
  Play,
  PlayCircle,
  ScanLine,
  Sparkles,
  Tv,
  Users,
  Wifi,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useAdminOverviewStats,
  useAdminScanRuns,
  useLibraries,
  useMoviesNeedingReview,
  useNowPlaying,
  useReadiness,
  useRecentlyAddedCatalog,
} from "../../api/hooks";
import type {
  AdminOverviewStats,
  AdminScanRun,
  CatalogItem,
  NeedsReviewMovie,
  NowPlayingData,
  NowPlayingSession,
} from "../../api/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  type BadgeTone,
  FancyEmpty,
  StatCard,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import {
  inkAlpha,
  peachAlpha,
  scrim,
  status as statusTone,
  whiteAlpha,
} from "../../theme/tokens";
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
 * Compact ``MM-DD · HH:MM`` stamp for the scan-activity rows —
 * mono affordance, parsed through the shared server-time helper so
 * it lands in the viewer's local zone.
 */
function formatScanTimestamp(iso: string): string {
  const d = new Date(parseServerTime(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Admin Overview dashboard.
 *
 * The operator's at-a-glance answer to "is the server healthy, who's
 * watching, what did the scanner add, what needs attention". Composed
 * top-to-bottom: header + shortcut CTAs, a six-up stat strip, the
 * (placeholder) live-sessions panel, a recently-added poster strip, a
 * flagged + scan-activity row, and a disk + health row.
 *
 * Each panel binds its own query so the page degrades per-panel rather
 * than on a single page-wide failure. The two panels that depend on
 * not-yet-built backend (live sessions, per-library disk) render a calm
 * "coming soon" placeholder.
 */
export function AdminOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("admin.overview.title"));

  const stats = useAdminOverviewStats();
  const reviewQueue = useMoviesNeedingReview();
  const nowPlaying = useNowPlaying();
  const reviewCount = stats.data?.review_count ?? reviewQueue.data?.length ?? 0;
  const statsLoading = stats.isLoading;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[t("admin.nav.overview")]}
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
        primaryCTA={
          <Box sx={{ display: "flex", gap: 1 }}>
            <AdminButton
              icon={<Sparkles size={14} />}
              onClick={() => navigate("/admin/enrich")}
            >
              {t("admin.overview.cta.enrich")}
            </AdminButton>
            <AdminButton
              variant="primary"
              icon={<ScanLine size={14} />}
              onClick={() => navigate("/admin/scan")}
            >
              {t("admin.overview.cta.scan")}
            </AdminButton>
          </Box>
        }
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(6, 1fr)",
          },
          gap: 1.5,
          mb: 3,
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
          label={t("admin.overview.stats.streaming")}
          value={nowPlaying.data?.sessions.length ?? 0}
          sub={t("admin.overview.stats.streamingSub", {
            mbps: (nowPlaying.data?.total_mbps ?? 0).toFixed(1),
          })}
          icon={PlayCircle}
          loading={nowPlaying.isLoading}
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

      <Box sx={{ mb: 2 }}>
        <NowPlayingPanel data={nowPlaying.data} loading={nowPlaying.isLoading} />
      </Box>

      <Box sx={{ mb: 2 }}>
        <RecentlyAddedPanel onSeeCatalog={() => navigate("/admin/catalog/movies")} />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
          gap: 2,
          alignItems: "stretch",
          mb: 2,
        }}
      >
        <RecentlyFlaggedPanel
          movies={reviewQueue.data}
          loading={reviewQueue.isLoading}
          onSeeAll={() => navigate("/admin/catalog/review")}
        />
        <ScanActivityPanel onHistory={() => navigate("/admin/scan")} />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <DiskUsagePanel />
        <SystemHealthPanel />
      </Box>
    </>
  );
}

const SESSION_TONES = ["#5a2818", "#2a1850", "#18304a", "#1a4030", "#3a2a1a", "#2f3a4a"];

function initialsFor(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarToneFor(name: string | null): string {
  if (!name) return SESSION_TONES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SESSION_TONES[hash % SESSION_TONES.length];
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Live-sessions panel — the signature surface of the page, showing
 * what's playing on the server right now (polled by ``useNowPlaying``).
 * An idle server shows a calm empty state, the expected resting state.
 */
function NowPlayingPanel({
  data,
  loading,
}: {
  data: NowPlayingData | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const sessions = data?.sessions ?? [];
  const totalMbps = data?.total_mbps ?? 0;

  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.nowPlaying.title")}
        subtitle={t("admin.overview.nowPlaying.subtitle")}
        action={
          sessions.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                color: "primary.main",
              }}
            >
              <Wifi size={14} aria-hidden />
              <Typography variant="metaMono" sx={{ color: "text.secondary" }}>
                {t("admin.overview.nowPlaying.uplink", { mbps: totalMbps.toFixed(1) })}
              </Typography>
            </Box>
          ) : undefined
        }
      />

      {loading && !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      ) : sessions.length === 0 ? (
        <FancyEmpty
          icon={PlayCircle}
          title={t("admin.overview.nowPlaying.emptyTitle")}
          body={t("admin.overview.nowPlaying.emptyBody")}
          badge={t("admin.overview.nowPlaying.emptyBadge")}
          badgeTone="ok"
          meta={t("admin.overview.nowPlaying.emptyMeta")}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {sessions.map((session, index) => (
            <SessionRow
              key={`${session.media_id}-${session.profile_id}-${index}`}
              session={session}
              last={index === sessions.length - 1}
            />
          ))}
        </Box>
      )}
    </AdminCard>
  );
}

function SessionRow({ session, last }: { session: NowPlayingSession; last: boolean }) {
  const { t } = useTranslation();
  const transcode = session.mode === "transcode";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "40px 1fr", sm: "40px 1.3fr 1fr 150px" },
        alignItems: "center",
        gap: 2,
        py: 1.5,
        borderBottom: last ? "none" : `1px solid ${whiteAlpha(0.06)}`,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 40,
          height: 56,
          borderRadius: "3px",
          overflow: "hidden",
          bgcolor: whiteAlpha(0.06),
          flexShrink: 0,
        }}
      >
        {session.poster_url && (
          <Box
            component="img"
            src={session.poster_url}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: scrim(0.25),
          }}
        >
          <Play size={13} color="rgba(255,255,255,0.92)" aria-hidden />
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap>
          {session.title ?? "—"}
        </Typography>
        {session.meta && (
          <Typography
            variant="metaMono"
            color="text.secondary"
            noWrap
            sx={{ display: "block", mt: 0.25 }}
          >
            {session.meta}
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: avatarToneFor(session.profile_name),
              color: "#F5F1EB",
              fontSize: "0.5rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {initialsFor(session.profile_name)}
          </Box>
          <Typography variant="metaMono" sx={{ color: inkAlpha(0.7) }} noWrap>
            {session.profile_name ?? t("admin.overview.nowPlaying.unknownProfile")}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
        <Box
          sx={{
            height: 4,
            borderRadius: 999,
            bgcolor: whiteAlpha(0.08),
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${session.pct}%`,
              height: "100%",
              borderRadius: 999,
              bgcolor: transcode ? statusTone.warn.fg : "primary.main",
              transition: "width 300ms ease",
            }}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
          <Typography variant="metaMono" color="text.secondary">
            {formatClock(session.position_seconds)}
          </Typography>
          <Typography variant="metaMono" color="text.secondary">
            {session.duration_seconds ? formatClock(session.duration_seconds) : "—"}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0.5,
          minWidth: 0,
        }}
      >
        {session.mode && (
          <AdminBadge tone={transcode ? "warn" : "ok"}>{session.mode}</AdminBadge>
        )}
        <Typography variant="metaMono" sx={{ color: "primary.main" }}>
          {session.mbps.toFixed(1)} Mbps
        </Typography>
        {session.device && (
          <Typography
            variant="metaMono"
            color="text.secondary"
            noWrap
            sx={{ maxWidth: 150 }}
          >
            {session.device}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

const RECENTLY_ADDED_LIMIT = 8;

/**
 * Horizontal poster strip of the most recently indexed titles.
 *
 * Backed by ``useRecentlyAddedCatalog`` — the mixed movie/series
 * catalog feed. The catalog item is thin (no per-title "added" date
 * or resolution), so tiles show poster + title + year and drop the
 * handoff's 4K chip / added-date until the feed carries them.
 */
function RecentlyAddedPanel({ onSeeCatalog }: { onSeeCatalog: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useRecentlyAddedCatalog(RECENTLY_ADDED_LIMIT);
  const items = data ?? [];

  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.recentlyAdded.title")}
        subtitle={t("admin.overview.recentlyAdded.subtitle")}
        action={
          <AdminButton
            variant="ghost"
            size="small"
            icon={<ArrowRight size={13} />}
            onClick={onSeeCatalog}
          >
            {t("admin.overview.recentlyAdded.seeCatalog")}
          </AdminButton>
        }
      />

      {isLoading ? (
        <Box sx={{ display: "flex", gap: 2.25, overflow: "hidden" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              width={116}
              height={168}
              sx={{ flexShrink: 0, borderRadius: "6px" }}
            />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("admin.overview.recentlyAdded.empty")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 2.25, overflowX: "auto", pb: 0.75 }}>
          {items.map((item) => (
            <PosterTile key={item.id} item={item} />
          ))}
        </Box>
      )}
    </AdminCard>
  );
}

function PosterTile({ item }: { item: CatalogItem }) {
  return (
    <Box sx={{ width: 116, flexShrink: 0 }}>
      <Box
        sx={{
          position: "relative",
          width: 116,
          height: 168,
          borderRadius: "6px",
          overflow: "hidden",
          border: `1px solid ${whiteAlpha(0.07)}`,
          bgcolor: whiteAlpha(0.04),
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.poster_path ? (
          <Box
            component="img"
            src={item.poster_path}
            alt=""
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Typography
            aria-hidden
            sx={{ fontFamily: "Georgia, serif", fontSize: 32, color: whiteAlpha(0.14) }}
          >
            {item.title[0]}
          </Typography>
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, transparent 45%, ${scrim(0.55)} 100%)`,
          }}
        />
      </Box>
      <Typography variant="body2" fontWeight={500} noWrap sx={{ mt: 1 }}>
        {item.title}
      </Typography>
      <Typography variant="metaMono" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
        {item.year}
      </Typography>
    </Box>
  );
}

const SCAN_ACTIVITY_LIMIT = 5;

/**
 * Last few scan runs, mirroring the Scan page's history. Each row
 * sums the run's created / updated counts across movies + episodes
 * and surfaces error count only when non-zero.
 */
function ScanActivityPanel({ onHistory }: { onHistory: () => void }) {
  const { t } = useTranslation();
  const scanRuns = useAdminScanRuns(undefined, undefined, { pageSize: SCAN_ACTIVITY_LIMIT });
  const libraries = useLibraries();

  const libraryName = (id: string | null): string => {
    if (!id) return t("admin.overview.scanActivity.allLibraries");
    return (
      libraries.data?.find((library) => library.id === id)?.name ??
      t("admin.overview.scanActivity.allLibraries")
    );
  };

  const rows = scanRuns.items.slice(0, SCAN_ACTIVITY_LIMIT);

  return (
    <AdminCard sx={{ minHeight: 360 }}>
      <AdminCardHeader
        title={t("admin.overview.scanActivity.title")}
        subtitle={t("admin.overview.scanActivity.subtitle")}
        action={
          <AdminButton
            variant="ghost"
            size="small"
            icon={<ArrowRight size={13} />}
            onClick={onHistory}
          >
            {t("admin.overview.scanActivity.history")}
          </AdminButton>
        }
      />

      {scanRuns.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("admin.overview.scanActivity.empty")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {rows.map((run, index) => (
            <ScanActivityRow
              key={run.id}
              run={run}
              libraryName={libraryName(run.library_id)}
              last={index === rows.length - 1}
            />
          ))}
        </Box>
      )}
    </AdminCard>
  );
}

function ScanActivityRow({
  run,
  libraryName,
  last,
}: {
  run: AdminScanRun;
  libraryName: string;
  last: boolean;
}) {
  const created = (run.summary.movies_created ?? 0) + (run.summary.episodes_created ?? 0);
  const updated = (run.summary.movies_updated ?? 0) + (run.summary.episodes_updated ?? 0);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        py: 1.25,
        borderBottom: last ? "none" : `1px solid ${whiteAlpha(0.06)}`,
      }}
    >
      <Typography
        variant="metaMono"
        color="text.secondary"
        sx={{ width: 92, flexShrink: 0 }}
      >
        {formatScanTimestamp(run.started_at)}
      </Typography>
      <Typography
        variant="control"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {libraryName}
      </Typography>
      <Box sx={{ display: "inline-flex", gap: 1.5, flexShrink: 0 }}>
        <Typography variant="metaMono" sx={{ color: statusTone.ok.fg }}>
          +{created}
        </Typography>
        <Typography variant="metaMono" sx={{ color: inkAlpha(0.5) }}>
          ↻{updated}
        </Typography>
        {run.errors_count > 0 && (
          <Typography variant="metaMono" sx={{ color: statusTone.err.fg }}>
            !{run.errors_count}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Per-library disk usage panel. The size aggregation isn't exposed
 * by the backend yet, so this lands as a placeholder until the
 * library-storage endpoint ships.
 */
function DiskUsagePanel() {
  const { t } = useTranslation();
  return (
    <AdminCard>
      <AdminCardHeader
        title={t("admin.overview.diskUsage.title")}
        subtitle={t("admin.overview.diskUsage.subtitle")}
      />
      <FancyEmpty
        icon={HardDrive}
        title={t("admin.overview.diskUsage.emptyTitle")}
        body={t("admin.overview.diskUsage.emptyBody")}
        badge={t("admin.overview.diskUsage.emptyBadge")}
        badgeTone="warn"
      />
    </AdminCard>
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
    <AdminCard sx={{ minHeight: 360 }}>
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
        <FancyEmpty
          icon={CheckCircle2}
          title={t("admin.overview.recentlyFlagged.emptyTitle")}
          body={t("admin.overview.recentlyFlagged.empty")}
          badge={t("admin.overview.recentlyFlagged.emptyBadge")}
          badgeTone="ok"
        />
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
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
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
