import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Hls from "hls.js";
import { ArrowLeft, MapPin, Save, Trash2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useBulkSetEpisodeIntros,
  useClearEpisodeIntro,
  useSeriesDetail,
  useSetEpisodeIntro,
} from "../../api/hooks";
import type { EpisodeOutput, SeriesDetail } from "../../api/types";

function formatHms(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function IntroEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ seriesId: string; season: string; episode: string }>();

  const seriesId = params.seriesId ?? "";
  const seasonNumber = Number(params.season);
  const episodeNumber = Number(params.episode);

  const { data: seriesDetail, isLoading } = useSeriesDetail(seriesId);

  const episode = useMemo(() => {
    if (!seriesDetail) return null;
    const season = seriesDetail.seasons.find((s) => s.season_number === seasonNumber);
    return season?.episodes.find((e) => e.episode_number === episodeNumber) ?? null;
  }, [seriesDetail, seasonNumber, episodeNumber]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <IconButton onClick={() => navigate("/admin/intros")} aria-label={t("admin.intros.back")}>
          <ArrowLeft size={20} />
        </IconButton>
        <Typography variant="h2">{t("admin.intros.editorTitle")}</Typography>
      </Stack>

      {isLoading && <Typography color="text.secondary">{t("admin.intros.loading")}</Typography>}

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
    </Container>
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

  const [startSeconds, setStartSeconds] = useState<number>(episode.intro?.start_seconds ?? 0);
  const [endSeconds, setEndSeconds] = useState<number>(episode.intro?.end_seconds ?? 0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pendingBulk, setPendingBulk] = useState<"season" | "series" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Bulk-apply scope: every episode whose marker is either missing
  // or auto-detected. Manual markers are preserved so a confirmed
  // hand-edit never gets clobbered by a season-wide push. Drops
  // episodes with no id since they can't receive a PUT.
  const isEligible = (e: EpisodeOutput) =>
    e.id !== null && (e.intro === null || e.intro.source === "AUTO_DETECTED");

  const eligibleInSeason = useMemo<EpisodeOutput[]>(() => {
    const season = seriesDetail.seasons.find((s) => s.season_number === seasonNumber);
    return season?.episodes.filter(isEligible) ?? [];
  }, [seriesDetail, seasonNumber]);

  const eligibleInSeries = useMemo<EpisodeOutput[]>(
    () => seriesDetail.seasons.flatMap((s) => s.episodes.filter(isEligible)),
    [seriesDetail],
  );

  // First episode that still needs review (no marker or
  // auto-detected) strictly after the current one in
  // (season ASC, episode ASC) order. Powers auto-advance — null
  // when the editor is already past the last one to review.
  const nextEligible = useMemo<{ season: number; episode: number } | null>(() => {
    const candidates = seriesDetail.seasons.flatMap((s) =>
      s.episodes.map((ep) => ({
        season: s.season_number,
        episode: ep.episode_number,
        intro: ep.intro,
      })),
    );
    const hit = candidates.find(
      (c) =>
        (c.intro === null || c.intro.source === "AUTO_DETECTED") &&
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

  const markStart = useCallback(() => {
    setStartSeconds(Math.floor(currentTime));
  }, [currentTime]);

  const markEnd = useCallback(() => {
    setEndSeconds(Math.floor(currentTime));
  }, [currentTime]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3">{episode.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {seriesDetail.title} · {t("admin.intros.season", { number: seasonNumber })} ·{" "}
          {t("detail.episode", { number: episodeNumber })} ·{" "}
          {t("admin.intros.duration")}: {episode.duration_formatted}
        </Typography>
      </Box>

      {!episode.file_path ? (
        <Alert severity="info">{t("admin.intros.noFile")}</Alert>
      ) : (
        <Box
          sx={{
            bgcolor: "black",
            borderRadius: 1,
            overflow: "hidden",
            aspectRatio: "16 / 9",
            width: "100%",
            maxWidth: 960,
          }}
        >
          <video
            ref={videoRef}
            controls
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </Box>
      )}

      <TimelineOverlay
        duration={duration}
        currentTime={currentTime}
        startSeconds={startSeconds}
        endSeconds={endSeconds}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label={t("admin.intros.startSeconds")}
          type="number"
          size="small"
          value={startSeconds}
          onChange={(e) => setStartSeconds(Math.max(0, Number(e.target.value) || 0))}
          helperText={formatHms(startSeconds)}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          sx={{ flex: 1 }}
        />
        <Button startIcon={<MapPin size={16} />} onClick={markStart} disabled={!episode.file_path}>
          {t("admin.intros.markStart")}
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label={t("admin.intros.endSeconds")}
          type="number"
          size="small"
          value={endSeconds}
          onChange={(e) => setEndSeconds(Math.max(0, Number(e.target.value) || 0))}
          helperText={formatHms(endSeconds)}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          sx={{ flex: 1 }}
        />
        <Button startIcon={<MapPin size={16} />} onClick={markEnd} disabled={!episode.file_path}>
          {t("admin.intros.markEnd")}
        </Button>
      </Stack>

      {validationError && <Alert severity="error">{validationError}</Alert>}

      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<Save size={16} />}
          onClick={handleSave}
          disabled={!!validationError || setIntro.isPending || !episodeId}
        >
          {t("admin.intros.save")}
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Trash2 size={16} />}
          onClick={handleClear}
          disabled={clearIntro.isPending || !episodeId || !episode.intro}
        >
          {t("admin.intros.clear")}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          {t("admin.intros.currentTime")}: {formatHms(currentTime)}
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={<Zap size={16} />}
          onClick={() => setPendingBulk("season")}
          disabled={
            !!validationError || bulkSet.isPending || eligibleInSeason.length === 0
          }
        >
          {t("admin.intros.applyToSeason")} ({eligibleInSeason.length})
        </Button>
        <Button
          variant="outlined"
          startIcon={<Zap size={16} />}
          onClick={() => setPendingBulk("series")}
          disabled={
            !!validationError || bulkSet.isPending || eligibleInSeries.length === 0
          }
        >
          {t("admin.intros.applyToSeries")} ({eligibleInSeries.length})
        </Button>
        <FormControlLabel
          control={
            <Checkbox
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              size="small"
            />
          }
          label={t("admin.intros.autoAdvance")}
        />
      </Stack>

      <Dialog open={pendingBulk !== null} onClose={() => setPendingBulk(null)}>
        <DialogTitle>{t("admin.intros.bulkConfirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingBulk === "season"
              ? t("admin.intros.bulkConfirmSeason", {
                  count: eligibleInSeason.length,
                  season: seasonNumber,
                })
              : pendingBulk === "series"
                ? t("admin.intros.bulkConfirmSeries", { count: eligibleInSeries.length })
                : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {formatHms(startSeconds)} → {formatHms(endSeconds)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingBulk(null)} disabled={bulkSet.isPending}>
            {t("admin.intros.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={confirmBulkApply}
            disabled={bulkSet.isPending}
          >
            {bulkSet.isPending ? t("admin.intros.bulkInProgress") : t("admin.intros.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? <Alert severity={toast.severity}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Stack>
  );
}

interface TimelineOverlayProps {
  duration: number;
  currentTime: number;
  startSeconds: number;
  endSeconds: number;
}

function TimelineOverlay({
  duration,
  currentTime,
  startSeconds,
  endSeconds,
}: TimelineOverlayProps) {
  if (duration <= 0) return null;
  const startPct = Math.min(100, Math.max(0, (startSeconds / duration) * 100));
  const widthPct = Math.min(
    100 - startPct,
    Math.max(0, ((endSeconds - startSeconds) / duration) * 100),
  );
  const playheadPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));
  return (
    <Box
      sx={{
        position: "relative",
        height: 12,
        bgcolor: "action.disabledBackground",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${startPct}%`,
          width: `${widthPct}%`,
          bgcolor: "primary.main",
          opacity: 0.7,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${playheadPct}%`,
          width: 2,
          bgcolor: "secondary.main",
        }}
      />
    </Box>
  );
}
