import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import Hls from "hls.js";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FastForward,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Rewind,
  Save,
  ScrollText,
  SkipBack,
  SkipForward,
  Trash2,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useBulkSetEpisodeIntros,
  useClearEpisodeIntro,
  useMarkEpisodeIntroAbsent,
  useSeriesDetail,
  useSetEpisodeIntro,
} from "../../api/hooks";
import type { EpisodeOutput, SeriesDetail } from "../../api/types";
import {
  AdminButton,
  AdminCard,
  AdminDialog,
  AdminPageHeader,
  CreditsMarkerEditor,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { peach } from "../../theme/colors";
import { fontFamily, fontSize, inkAlpha, peachAlpha, scrim, status, whiteAlpha, toastSurfaceSx } from "../../theme/tokens";

function formatHms(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, "0")).join(":");
}

/**
 * Whether an episode still needs a human to look at its intro.
 *
 * Pending and auto-detected episodes qualify; MANUAL markers are
 * confirmed edits, and ABSENT is a confirmed verdict that there is no
 * intro. Both are deliberate decisions that must not be overwritten by
 * a bulk apply, nor offered again by auto-advance. ABSENT needs the
 * explicit check because such an episode also has ``intro === null``.
 */
function needsIntroReview(episode: {
  intro: EpisodeOutput["intro"];
  intro_status: EpisodeOutput["intro_status"];
}): boolean {
  if (episode.intro_status === "ABSENT") return false;
  return episode.intro === null || episode.intro.source === "AUTO_DETECTED";
}

/** Ordered (season, episode) coordinates of every episode in a series. */
interface EpisodeRef {
  season: number;
  episode: number;
  title: string;
  intro: EpisodeOutput["intro"];
  intro_status: EpisodeOutput["intro_status"];
}

/**
 * Flatten a series into one ordered list of episode coordinates.
 *
 * Seasons and episodes are sorted explicitly rather than trusted to
 * arrive ordered, so prev/next always step in broadcast order.
 */
function flattenEpisodes(seriesDetail: SeriesDetail): EpisodeRef[] {
  return [...seriesDetail.seasons]
    .sort((a, b) => a.season_number - b.season_number)
    .flatMap((s) =>
      [...s.episodes]
        .sort((a, b) => a.episode_number - b.episode_number)
        .map((ep) => ({
          season: s.season_number,
          episode: ep.episode_number,
          title: ep.title,
          intro: ep.intro,
          intro_status: ep.intro_status,
        })),
    );
}

const STATUS_COLOR: Record<EpisodeOutput["intro_status"], string> = {
  MARKED: status.ok.fg,
  ABSENT: status.info.fg,
  PENDING: "transparent",
};

/** Small dot conveying an episode's intro state inside the menu. */
function StatusDot({ state }: { state: EpisodeOutput["intro_status"] }) {
  return (
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: STATUS_COLOR[state],
        border: state === "PENDING" ? `1px solid ${whiteAlpha(0.25)}` : "none",
      }}
    />
  );
}

interface EpisodeNavigatorProps {
  seriesDetail: SeriesDetail;
  seasonNumber: number;
  episodeNumber: number;
}

/**
 * Move between episodes without leaving the editor.
 *
 * Reviewing intros is a per-episode loop, and previously the only way
 * to reach another episode was the browser back button plus finding
 * the series and season again in the picker. Prev/next step through
 * the whole series in order; the menu jumps anywhere within the
 * current season and shows each episode's state so the operator can
 * see what is left.
 */
function EpisodeNavigator({
  seriesDetail,
  seasonNumber,
  episodeNumber,
}: EpisodeNavigatorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [seasonAnchorEl, setSeasonAnchorEl] = useState<HTMLElement | null>(null);

  const all = useMemo(() => flattenEpisodes(seriesDetail), [seriesDetail]);
  const index = all.findIndex(
    (e) => e.season === seasonNumber && e.episode === episodeNumber,
  );
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  const seasonEpisodes = useMemo(
    () => all.filter((e) => e.season === seasonNumber),
    [all, seasonNumber],
  );

  // Each season with how much review it still needs, so the operator
  // can pick where the work is instead of opening seasons to find out.
  const seasons = useMemo(() => {
    const byNumber = new Map<number, { total: number; pending: number }>();
    for (const e of all) {
      const entry = byNumber.get(e.season) ?? { total: 0, pending: 0 };
      entry.total += 1;
      if (needsIntroReview(e)) entry.pending += 1;
      byNumber.set(e.season, entry);
    }
    return [...byNumber.entries()]
      .map(([number, counts]) => ({ number, ...counts }))
      .sort((a, b) => a.number - b.number);
  }, [all]);

  const go = (target: EpisodeRef) =>
    navigate(`/admin/intros/${seriesDetail.id}/${target.season}/${target.episode}`);

  const seasonLabel = (n: number) =>
    n === 0 ? t("admin.intros.specials") : t("admin.intros.season", { number: n });

  const label = (e: EpisodeRef) =>
    e.season === seasonNumber
      ? t("detail.episode", { number: e.episode })
      : `${t("admin.intros.season", { number: e.season })} · ${t("detail.episode", { number: e.episode })}`;

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Tooltip title={prev ? label(prev) : ""}>
        <span>
          <AdminButton
            variant="secondary"
            icon={<ChevronLeft size={14} />}
            onClick={() => prev && go(prev)}
            disabled={!prev}
          >
            {t("admin.intros.previousEpisode")}
          </AdminButton>
        </span>
      </Tooltip>

      <AdminButton
        variant="secondary"
        endIcon={<ChevronDown size={14} />}
        onClick={(e) => setSeasonAnchorEl(e.currentTarget)}
        sx={{ minWidth: 150, justifyContent: "flex-start", "& .MuiButton-endIcon": { ml: "auto" } }}
      >
        {seasonLabel(seasonNumber)}
      </AdminButton>
      <Menu
        anchorEl={seasonAnchorEl}
        open={!!seasonAnchorEl}
        onClose={() => setSeasonAnchorEl(null)}
      >
        {seasons.map((s) => (
          <MenuItem
            key={s.number}
            selected={s.number === seasonNumber}
            onClick={() => {
              setSeasonAnchorEl(null);
              // Land on the first episode still needing review, falling
              // back to the first one when the season is fully done —
              // switching season is a "take me to the work" action.
              const target =
                all.find((e) => e.season === s.number && needsIntroReview(e)) ??
                all.find((e) => e.season === s.number);
              if (target) go(target);
            }}
            sx={{ fontSize: fontSize.control, gap: 1.25 }}
          >
            <Box component="span" sx={{ minWidth: 96 }}>
              {seasonLabel(s.number)}
            </Box>
            <Box
              component="span"
              sx={{
                color: s.pending > 0 ? peach.main : "text.secondary",
                fontFamily: fontFamily.mono,
              }}
            >
              {s.pending > 0
                ? t("admin.intros.seasonPending", { count: s.pending })
                : t("admin.intros.seasonDone")}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <AdminButton
        variant="secondary"
        endIcon={<ChevronDown size={14} />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ minWidth: 168, justifyContent: "flex-start", "& .MuiButton-endIcon": { ml: "auto" } }}
      >
        {t("detail.episode", { number: episodeNumber })}
        <Box component="span" sx={{ color: "text.secondary", ml: 0.75 }}>
          / {seasonEpisodes.length}
        </Box>
      </AdminButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {seasonEpisodes.map((e) => (
          <MenuItem
            key={`${e.season}-${e.episode}`}
            selected={e.episode === episodeNumber}
            onClick={() => {
              setAnchorEl(null);
              go(e);
            }}
            sx={{ fontSize: fontSize.control, gap: 1.25, maxWidth: 420 }}
          >
            <StatusDot state={e.intro_status} />
            <Box component="span" sx={{ color: "text.secondary", minWidth: 34 }}>
              {t("detail.episode", { number: e.episode })}
            </Box>
            <Box
              component="span"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {e.title}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Tooltip title={next ? label(next) : ""}>
        <span>
          <AdminButton
            variant="secondary"
            endIcon={<ChevronRight size={14} />}
            onClick={() => next && go(next)}
            disabled={!next}
          >
            {t("admin.intros.nextEpisode")}
          </AdminButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export function IntroEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ seriesId: string; season: string; episode: string }>();

  const seriesId = params.seriesId ?? "";
  const seasonNumber = Number(params.season);
  const episodeNumber = Number(params.episode);

  const { data: seriesDetail, isLoading } = useSeriesDetail(seriesId);

  // Tab title shows the target episode coordinates so the operator
  // can keep multiple admin tabs open without losing track of which
  // episode each one is editing.
  useDocumentTitle(
    seriesDetail
      ? `${seriesDetail.title} · S${seasonNumber}E${episodeNumber} · ${t("admin.intros.editorTitle")}`
      : t("admin.intros.editorTitle"),
  );

  const episode = useMemo(() => {
    if (!seriesDetail) return null;
    const season = seriesDetail.seasons.find((s) => s.season_number === seasonNumber);
    return season?.episodes.find((e) => e.episode_number === episodeNumber) ?? null;
  }, [seriesDetail, seasonNumber, episodeNumber]);

  const subtitle = episode
    ? `${seriesDetail?.title} · ${t("admin.intros.season", { number: seasonNumber })} · ${t("detail.episode", { number: episodeNumber })} · ${t("admin.intros.duration")}: ${episode.duration_formatted}`
    : undefined;

  return (
    <>
      <AdminPageHeader
        breadcrumb={[
          t("admin.nav.group.catalog"),
          { label: t("admin.nav.intros"), to: "/admin/intros" },
          t("admin.intros.editorTitle"),
        ]}
        title={episode?.title ?? t("admin.intros.editorTitle")}
        subtitle={subtitle}
        primaryCTA={
          <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
            {seriesDetail && (
              <EpisodeNavigator
                seriesDetail={seriesDetail}
                seasonNumber={seasonNumber}
                episodeNumber={episodeNumber}
              />
            )}
            <AdminButton
              variant="ghost"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate("/admin/intros")}
            >
              {t("admin.intros.back")}
            </AdminButton>
          </Stack>
        }
      />

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={20} color="primary" />
        </Box>
      )}

      {!isLoading && !episode && (
        <Alert severity="warning">{t("admin.intros.episodeNotFound")}</Alert>
      )}

      {seriesDetail && episode && (
        <EditorForm
          // Re-mount the form when the route target changes so its
          // useState initializers re-seed from the new episode's
          // persisted marker. Avoids a setState-in-effect dance.
          key={`${seriesId}/${seasonNumber}/${episodeNumber}`}
          seriesDetail={seriesDetail}
          episode={episode}
          seriesId={seriesId}
          seasonNumber={seasonNumber}
          episodeNumber={episodeNumber}
        />
      )}
    </>
  );
}

interface EditorFormProps {
  seriesDetail: SeriesDetail;
  episode: EpisodeOutput;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
}

function EditorForm({
  seriesDetail,
  episode,
  seriesId,
  seasonNumber,
  episodeNumber,
}: EditorFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const episodeId = episode.id;
  const duration = episode.duration_seconds;

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [startSeconds, setStartSeconds] = useState<number>(episode.intro?.start_seconds ?? 0);
  const [endSeconds, setEndSeconds] = useState<number>(episode.intro?.end_seconds ?? 0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pendingBulk, setPendingBulk] = useState<"season" | "series" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Moving the start past the end would leave the marker invalid, so the
  // end is pushed along instead of the start being pinned to it. That is
  // also what makes an untouched episode editable at all: with start and
  // end both seeded to 0, clamping the start to ``[0, end - 1]`` yielded
  // an empty range that collapsed every value back to 0, so the start
  // looked frozen until an end had been entered.
  const applyStart = useCallback(
    (value: number) => {
      const ceiling = duration > 0 ? Math.max(0, duration - 1) : Math.max(0, value);
      const nextStart = clampInt(value, 0, ceiling);
      setStartSeconds(nextStart);
      setEndSeconds((prev) =>
        prev > nextStart
          ? prev
          : clampInt(nextStart + 1, nextStart + 1, duration > 0 ? duration : nextStart + 1),
      );
    },
    [duration],
  );

  // Bulk-apply scope: every episode whose marker is either missing
  // or auto-detected. Manual markers are preserved so a confirmed
  // hand-edit never gets clobbered by a season-wide push. Drops
  // episodes with no id since they can't receive a PUT.
  const isEligible = (e: EpisodeOutput) => e.id !== null && needsIntroReview(e);

  const eligibleInSeason = useMemo<EpisodeOutput[]>(() => {
    const season = seriesDetail.seasons.find((s) => s.season_number === seasonNumber);
    return season?.episodes.filter(isEligible) ?? [];
  }, [seriesDetail, seasonNumber]);

  const eligibleInSeries = useMemo<EpisodeOutput[]>(
    () => seriesDetail.seasons.flatMap((s) => s.episodes.filter(isEligible)),
    [seriesDetail],
  );

  // First episode that still needs review strictly after the current
  // one in (season ASC, episode ASC) order. Powers auto-advance — null
  // when the editor is already past the last one to review.
  const nextEligible = useMemo<{ season: number; episode: number } | null>(() => {
    const candidates = seriesDetail.seasons.flatMap((s) =>
      s.episodes.map((ep) => ({
        season: s.season_number,
        episode: ep.episode_number,
        intro: ep.intro,
        intro_status: ep.intro_status,
      })),
    );
    const hit = candidates.find(
      (c) =>
        needsIntroReview(c) &&
        (c.season > seasonNumber ||
          (c.season === seasonNumber && c.episode > episodeNumber)),
    );
    return hit ? { season: hit.season, episode: hit.episode } : null;
  }, [seriesDetail, seasonNumber, episodeNumber]);

  const hlsUrl = episode.file_path
    ? `/api/v1/stream/episode/${seriesId}/${seasonNumber}/${episodeNumber}/hls/playlist.m3u8`
    : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, startPosition: 0 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    }
    return undefined;
  }, [hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, []);

  const validationError = useMemo(() => {
    if (endSeconds <= startSeconds) return t("admin.intros.validationEndAfterStart");
    if (duration > 0 && endSeconds > duration) return t("admin.intros.validationWithinDuration");
    return null;
  }, [startSeconds, endSeconds, duration, t]);

  const setIntro = useSetEpisodeIntro();
  const clearIntro = useClearEpisodeIntro();
  const markAbsent = useMarkEpisodeIntroAbsent();
  const bulkSet = useBulkSetEpisodeIntros();

  const [toast, setToast] = useState<{ severity: "success" | "error"; message: string } | null>(
    null,
  );

  const handleSave = useCallback(() => {
    if (!episodeId || validationError) return;
    setIntro.mutate(
      { episodeId, seriesId, start_seconds: startSeconds, end_seconds: endSeconds },
      {
        onSuccess: () => {
          setToast({ severity: "success", message: t("admin.intros.saved") });
          if (autoAdvance && nextEligible) {
            navigate(
              `/admin/intros/${seriesId}/${nextEligible.season}/${nextEligible.episode}`,
            );
          }
        },
        onError: () => setToast({ severity: "error", message: t("admin.intros.saveFailed") }),
      },
    );
  }, [
    episodeId,
    validationError,
    setIntro,
    seriesId,
    startSeconds,
    endSeconds,
    autoAdvance,
    nextEligible,
    navigate,
    t,
  ]);

  const confirmBulkApply = useCallback(() => {
    if (!pendingBulk || validationError) {
      setPendingBulk(null);
      return;
    }
    const targets = pendingBulk === "season" ? eligibleInSeason : eligibleInSeries;
    const ids = targets.map((e) => e.id).filter((id): id is string => id !== null);
    if (ids.length === 0) {
      setPendingBulk(null);
      return;
    }
    bulkSet.mutate(
      { episodeIds: ids, seriesId, start_seconds: startSeconds, end_seconds: endSeconds },
      {
        onSuccess: ({ succeeded, failed }) => {
          setPendingBulk(null);
          setToast(
            failed === 0
              ? {
                  severity: "success",
                  message: t("admin.intros.bulkSucceeded", { count: succeeded }),
                }
              : {
                  severity: "error",
                  message: t("admin.intros.bulkPartial", { succeeded, failed }),
                },
          );
        },
        onError: () => {
          setPendingBulk(null);
          setToast({ severity: "error", message: t("admin.intros.saveFailed") });
        },
      },
    );
  }, [
    pendingBulk,
    validationError,
    eligibleInSeason,
    eligibleInSeries,
    bulkSet,
    seriesId,
    startSeconds,
    endSeconds,
    t,
  ]);

  const handleClear = useCallback(() => {
    if (!episodeId) return;
    clearIntro.mutate(
      { episodeId, seriesId },
      {
        onSuccess: () => {
          setStartSeconds(0);
          setEndSeconds(0);
          setToast({ severity: "success", message: t("admin.intros.cleared") });
        },
        onError: () => setToast({ severity: "error", message: t("admin.intros.clearFailed") }),
      },
    );
  }, [episodeId, clearIntro, seriesId, t]);

  const handleMarkAbsent = useCallback(() => {
    if (!episodeId) return;
    markAbsent.mutate(
      { episodeId, seriesId },
      {
        onSuccess: () => {
          // Any marker was dropped server-side; mirror that locally so
          // the fields do not keep showing a range that no longer exists.
          setStartSeconds(0);
          setEndSeconds(0);
          setToast({ severity: "success", message: t("admin.intros.markedNoIntro") });
          // This resolves the episode just as saving does, so it moves
          // on rather than stranding the operator on a finished episode
          // with no way forward but the back button.
          if (autoAdvance && nextEligible) {
            navigate(
              `/admin/intros/${seriesId}/${nextEligible.season}/${nextEligible.episode}`,
            );
          }
        },
        onError: () =>
          setToast({ severity: "error", message: t("admin.intros.markNoIntroFailed") }),
      },
    );
  }, [episodeId, markAbsent, seriesId, autoAdvance, nextEligible, navigate, t]);

  // ── Transport (custom controls on top of the native ones) ──────────
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const seekTo = useCallback(
    (target: number) => {
      const video = videoRef.current;
      const max = duration > 0 ? duration : target;
      const clamped = Math.max(0, Math.min(max, target));
      if (video) video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 432px" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        {/* ── Player + timeline ─────────────────────────── */}
        <Stack spacing={2}>
          <AdminCard>
            {!episode.file_path ? (
              <Alert severity="info">{t("admin.intros.noFile")}</Alert>
            ) : (
              <>
                <Box
                  sx={{
                    bgcolor: "black",
                    borderRadius: 1,
                    overflow: "hidden",
                    aspectRatio: "16 / 9",
                    width: "100%",
                  }}
                >
                  <video
                    ref={videoRef}
                    controls
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                </Box>

                {/* Transport */}
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  sx={{ mt: 1.75, rowGap: 1 }}
                >
                  <TransportButton onClick={() => seekTo(currentTime - 5)} icon={<Rewind size={14} />}>
                    5s
                  </TransportButton>
                  <TransportButton
                    onClick={togglePlay}
                    primary
                    icon={playing ? <Pause size={14} /> : <Play size={14} />}
                  >
                    {playing ? t("admin.intros.pause") : t("admin.intros.play")}
                  </TransportButton>
                  <TransportButton onClick={() => seekTo(currentTime + 5)} iconEnd={<FastForward size={14} />}>
                    5s
                  </TransportButton>
                  <Box sx={{ flex: 1, minWidth: 8 }} />
                  <TransportButton onClick={() => seekTo(startSeconds)} icon={<SkipBack size={13} />} subtle>
                    {t("admin.intros.goToStart")} {formatHms(startSeconds)}
                  </TransportButton>
                  <TransportButton onClick={() => seekTo(endSeconds)} iconEnd={<SkipForward size={13} />} subtle>
                    {t("admin.intros.goToEnd")} {formatHms(endSeconds)}
                  </TransportButton>
                </Stack>
              </>
            )}
          </AdminCard>

          {/* Timeline scrubber */}
          <AdminCard>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="eyebrow" sx={{ color: "text.secondary" }}>
                {t("admin.intros.timeline")}
              </Typography>
              <Typography variant="metaMono" sx={{ color: "text.secondary" }}>
                {formatHms(currentTime)} / {formatHms(duration)}
              </Typography>
            </Stack>
            <TimelineScrubber
              duration={duration}
              currentTime={currentTime}
              startSeconds={startSeconds}
              endSeconds={endSeconds}
              onSeek={seekTo}
              onStartChange={applyStart}
              onEndChange={(v) =>
                setEndSeconds(clampInt(v, startSeconds + 1, duration > 0 ? duration : v))
              }
            />
            <Typography
              variant="metaMono"
              sx={{ display: "block", mt: 1.25, color: "text.secondary", textAlign: "right" }}
            >
              {t("admin.intros.timelineHint")}
            </Typography>
          </AdminCard>
        </Stack>

        {/* ── Control panel ─────────────────────────────── */}
        <Stack spacing={2.5} sx={{ position: { lg: "sticky" }, top: 0 }}>
          {/* Marker card */}
          <AdminCard>
            <Typography
              variant="eyebrow"
              component="div"
              sx={{ color: "text.secondary", mb: 1.75 }}
            >
              {t("admin.intros.markerCardTitle")}
            </Typography>
            <Stack spacing={1.75}>
              <TimeField
                label={t("admin.intros.startLabel")}
                value={startSeconds}
                disabled={!episode.file_path}
                onStep={(d) => applyStart(startSeconds + d)}
                onUseCurrent={() => applyStart(Math.floor(currentTime))}
              />
              <TimeField
                label={t("admin.intros.endLabel")}
                value={endSeconds}
                disabled={!episode.file_path}
                onStep={(d) =>
                  setEndSeconds(
                    clampInt(endSeconds + d, startSeconds + 1, duration > 0 ? duration : endSeconds + d),
                  )
                }
                onUseCurrent={() =>
                  setEndSeconds(
                    clampInt(
                      Math.floor(currentTime),
                      startSeconds + 1,
                      duration > 0 ? duration : Math.floor(currentTime),
                    ),
                  )
                }
              />
            </Stack>

            {validationError && (
              <Alert severity="error" sx={{ mt: 1.75 }}>
                {validationError}
              </Alert>
            )}

            {/* intro duration readout */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1.75,
                px: 1.75,
                py: 1.25,
                borderRadius: 1,
                bgcolor: peachAlpha(0.07),
                border: `1px solid ${peachAlpha(0.2)}`,
              }}
            >
              <Typography variant="body2" sx={{ fontSize: "0.875rem", color: inkAlpha(0.7) }}>
                {t("admin.intros.introDuration")}
              </Typography>
              <Typography
                variant="metaMono"
                sx={{ fontSize: "0.9375rem", fontWeight: 600, color: peach.main }}
              >
                {formatHms(Math.max(0, endSeconds - startSeconds))}
              </Typography>
            </Box>

            {/* actions */}
            <Stack spacing={1.25} sx={{ mt: 1.75 }}>
              <AdminButton
                variant="primary"
                icon={<Save size={15} />}
                onClick={handleSave}
                disabled={!!validationError || setIntro.isPending || !episodeId}
                fullWidth
              >
                {t("admin.intros.save")}
              </AdminButton>
              <Tooltip title={t("admin.intros.markNoIntroHint")}>
                <span>
                  <AdminButton
                    variant="secondary"
                    icon={<Ban size={13} />}
                    onClick={handleMarkAbsent}
                    disabled={
                      markAbsent.isPending ||
                      !episodeId ||
                      episode.intro_status === "ABSENT"
                    }
                    fullWidth
                  >
                    {episode.intro_status === "ABSENT"
                      ? t("admin.intros.statusNoIntro")
                      : t("admin.intros.markNoIntro")}
                  </AdminButton>
                </span>
              </Tooltip>
              <Stack direction="row" spacing={1.25} justifyContent="space-between">
                <AdminButton
                  variant="danger"
                  icon={<Trash2 size={13} />}
                  onClick={handleClear}
                  disabled={
                    clearIntro.isPending ||
                    !episodeId ||
                    (!episode.intro && episode.intro_status !== "ABSENT")
                  }
                >
                  {t("admin.intros.clear")}
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  icon={<ScrollText size={13} />}
                  onClick={() => setCreditsOpen(true)}
                  disabled={!episodeId}
                >
                  {t("admin.credits.editButton")}
                </AdminButton>
              </Stack>
            </Stack>
          </AdminCard>

          {/* Bulk apply card */}
          <AdminCard>
            <Typography
              variant="eyebrow"
              component="div"
              sx={{ color: "text.secondary", mb: 0.75 }}
            >
              {t("admin.intros.bulkApplyTitle")}
            </Typography>
            <Typography variant="body2" sx={{ color: inkAlpha(0.5), mb: 1.75, lineHeight: 1.5 }}>
              {t("admin.intros.bulkApplyDesc")}
            </Typography>
            <Stack spacing={1.25}>
              <AdminButton
                variant="secondary"
                icon={<Zap size={14} />}
                onClick={() => setPendingBulk("season")}
                disabled={!!validationError || bulkSet.isPending || eligibleInSeason.length === 0}
                fullWidth
              >
                {t("admin.intros.applyToSeason")} ({eligibleInSeason.length})
              </AdminButton>
              <AdminButton
                variant="secondary"
                icon={<Zap size={14} />}
                onClick={() => setPendingBulk("series")}
                disabled={!!validationError || bulkSet.isPending || eligibleInSeries.length === 0}
                fullWidth
              >
                {t("admin.intros.applyToSeries")} ({eligibleInSeries.length})
              </AdminButton>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {t("admin.intros.autoAdvance")}
                </Typography>
              }
              sx={{ mt: 1.25, ml: 0, alignItems: "flex-start" }}
            />
          </AdminCard>
        </Stack>
      </Box>

      {creditsOpen && episodeId && (
        <CreditsMarkerEditor
          open
          onClose={() => setCreditsOpen(false)}
          mediaId={episodeId}
          mediaTitle={episode.title}
          durationSeconds={duration}
          marker={episode.credits}
          seriesId={seriesId}
          suggestedSeconds={currentTime}
        />
      )}

      <AdminDialog
        open={pendingBulk !== null}
        onClose={() => setPendingBulk(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          {t("admin.intros.bulkConfirmTitle")}
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Typography variant="body2" sx={{ color: inkAlpha(0.72) }}>
            {pendingBulk === "season"
              ? t("admin.intros.bulkConfirmSeason", {
                  count: eligibleInSeason.length,
                  season: seasonNumber,
                })
              : pendingBulk === "series"
                ? t("admin.intros.bulkConfirmSeries", { count: eligibleInSeries.length })
                : ""}
          </Typography>
          <Typography
            variant="metaMono"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            {formatHms(startSeconds)} → {formatHms(endSeconds)}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.25 }}>
          <AdminButton
            variant="ghost"
            onClick={() => setPendingBulk(null)}
            disabled={bulkSet.isPending}
          >
            {t("admin.intros.cancel")}
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={confirmBulkApply}
            disabled={bulkSet.isPending}
            icon={
              bulkSet.isPending ? <CircularProgress size={12} sx={{ color: "inherit" }} /> : undefined
            }
          >
            {bulkSet.isPending ? t("admin.intros.bulkInProgress") : t("admin.intros.confirm")}
          </AdminButton>
        </DialogActions>
      </AdminDialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Box
            sx={{
              ...toastSurfaceSx(toast.severity),
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {toast.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

interface TransportButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  primary?: boolean;
  subtle?: boolean;
}

function TransportButton({ onClick, children, icon, iconEnd, primary, subtle }: TransportButtonProps) {
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.625,
        px: subtle ? 1 : 1.625,
        py: 1,
        borderRadius: "6px",
        fontFamily: subtle ? fontFamily.mono : "inherit",
        fontSize: subtle ? "0.75rem" : fontSize.control,
        fontWeight: primary ? 600 : 500,
        color: subtle ? "text.secondary" : "text.primary",
        bgcolor: subtle ? "transparent" : primary ? whiteAlpha(0.08) : whiteAlpha(0.03),
        border: `1px solid ${subtle ? "transparent" : whiteAlpha(0.08)}`,
        transition: "background-color 120ms ease, color 120ms ease",
        "&:hover": { bgcolor: whiteAlpha(subtle ? 0.04 : 0.1), color: "text.primary" },
      }}
    >
      {icon}
      {children}
      {iconEnd}
    </ButtonBase>
  );
}

interface TimeFieldProps {
  label: string;
  value: number;
  disabled?: boolean;
  onStep: (delta: number) => void;
  onUseCurrent: () => void;
}

function TimeField({ label, value, disabled, onStep, onUseCurrent }: TimeFieldProps) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="eyebrow" component="label" sx={{ display: "block", color: "text.secondary", mb: 0.875 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            flex: 1,
            bgcolor: whiteAlpha(0.03),
            border: `1px solid ${whiteAlpha(0.08)}`,
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <StepButton onClick={() => onStep(-1)} disabled={disabled}>
            <Minus size={16} />
          </StepButton>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography variant="metaMono" sx={{ display: "block", fontSize: "1rem", fontWeight: 600 }}>
              {formatHms(value)}
            </Typography>
            <Typography variant="metaMono" sx={{ display: "block", fontSize: "0.6875rem", color: "text.secondary" }}>
              {Math.round(value)}s
            </Typography>
          </Box>
          <StepButton onClick={() => onStep(1)} disabled={disabled}>
            <Plus size={16} />
          </StepButton>
        </Stack>
        <ButtonBase
          type="button"
          onClick={onUseCurrent}
          disabled={disabled}
          title={t("admin.intros.useCurrentTime")}
          sx={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.5,
            borderRadius: "6px",
            bgcolor: whiteAlpha(0.04),
            border: `1px solid ${whiteAlpha(0.08)}`,
            color: "text.primary",
            fontFamily: "inherit",
            fontSize: fontSize.control,
            fontWeight: 500,
            opacity: disabled ? 0.5 : 1,
            transition: "background-color 120ms ease",
            "&:hover": { bgcolor: disabled ? whiteAlpha(0.04) : whiteAlpha(0.08) },
          }}
        >
          <MapPin size={13} />
          {t("admin.intros.useCurrentTime")}
        </ButtonBase>
      </Stack>
    </Box>
  );
}

function StepButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: 40,
        alignSelf: "stretch",
        color: inkAlpha(0.6),
        opacity: disabled ? 0.4 : 1,
        transition: "background-color 120ms ease, color 120ms ease",
        "&:hover": { bgcolor: disabled ? "transparent" : whiteAlpha(0.05), color: "text.primary" },
      }}
    >
      {children}
    </ButtonBase>
  );
}

interface TimelineScrubberProps {
  duration: number;
  currentTime: number;
  startSeconds: number;
  endSeconds: number;
  onSeek: (t: number) => void;
  onStartChange: (t: number) => void;
  onEndChange: (t: number) => void;
}

function TimelineScrubber({
  duration,
  currentTime,
  startSeconds,
  endSeconds,
  onSeek,
  onStartChange,
  onEndChange,
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | "seek" | null>(null);
  const safeDuration = duration > 0 ? duration : 1;

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(safeDuration, ((clientX - r.left) / r.width) * safeDuration));
    },
    [safeDuration],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const t = timeFromClientX(e.clientX);
      if (drag === "start") onStartChange(t);
      else if (drag === "end") onEndChange(t);
      else onSeek(t);
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, timeFromClientX, onStartChange, onEndChange, onSeek]);

  const pStart = (Math.min(startSeconds, safeDuration) / safeDuration) * 100;
  const pEnd = (Math.min(endSeconds, safeDuration) / safeDuration) * 100;
  const pCur = (Math.min(currentTime, safeDuration) / safeDuration) * 100;

  return (
    <Box
      ref={trackRef}
      onPointerDown={(e) => {
        onSeek(timeFromClientX(e.clientX));
        setDrag("seek");
      }}
      sx={{
        position: "relative",
        height: 60,
        borderRadius: "7px",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        bgcolor: whiteAlpha(0.04),
        backgroundImage: `repeating-linear-gradient(90deg, ${whiteAlpha(0.03)} 0 1px, transparent 1px 40px)`,
      }}
    >
      {/* dim outside the intro */}
      <Box sx={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pStart}%`, bgcolor: scrim(0.62) }} />
      <Box sx={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${100 - pEnd}%`, bgcolor: scrim(0.62) }} />
      {/* intro band */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${pStart}%`,
          width: `${Math.max(0, pEnd - pStart)}%`,
          border: `2px solid ${peach.main}`,
          borderRadius: "4px",
          bgcolor: peachAlpha(0.1),
        }}
      />
      <ScrubHandle pos={pStart} onDown={() => setDrag("start")} />
      <ScrubHandle pos={pEnd} onDown={() => setDrag("end")} />
      {/* playhead */}
      <Box
        sx={{
          position: "absolute",
          top: -4,
          bottom: -4,
          left: `${pCur}%`,
          width: 2,
          bgcolor: inkAlpha(0.95),
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -5,
            left: -4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: inkAlpha(0.95),
          }}
        />
      </Box>
    </Box>
  );
}

function ScrubHandle({ pos, onDown }: { pos: number; onDown: () => void }) {
  return (
    <Box
      onPointerDown={(e) => {
        e.stopPropagation();
        onDown();
      }}
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${pos}%`,
        width: 16,
        transform: "translateX(-50%)",
        cursor: "ew-resize",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ position: "absolute", top: 0, bottom: 0, width: 3, bgcolor: peach.main }} />
      <Box
        sx={{
          width: 12,
          height: 26,
          borderRadius: "4px",
          bgcolor: peach.main,
          border: `1px solid ${scrim(0.35)}`,
        }}
      />
    </Box>
  );
}
