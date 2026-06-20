import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Hls from "hls.js";
import { ArrowLeft, MapPin, Save, ScrollText, Trash2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useBulkSetEpisodeIntros,
  useClearEpisodeIntro,
  useSeriesDetail,
  useSetEpisodeIntro,
} from "../../api/hooks";
import type { EpisodeOutput, SeriesDetail } from "../../api/types";
import {
  AdminButton,
  AdminCard,
  AdminDialog,
  AdminInput,
  AdminPageHeader,
  CreditsMarkerEditor,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { accentGold, inkAlpha, status, whiteAlpha } from "../../theme/tokens";

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
          <AdminButton
            variant="ghost"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate("/admin/intros")}
          >
            {t("admin.intros.back")}
          </AdminButton>
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
    <>
      <Stack spacing={2.5}>
        <AdminCard>
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
                mx: "auto",
              }}
            >
              <video
                ref={videoRef}
                controls
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </Box>
          )}

          <Box sx={{ mt: 2.5 }}>
            <TimelineOverlay
              duration={duration}
              currentTime={currentTime}
              startSeconds={startSeconds}
              endSeconds={endSeconds}
            />
          </Box>
        </AdminCard>

        <AdminCard>
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 260px" },
                columnGap: 2,
                rowGap: 2,
                alignItems: "center",
              }}
            >
              <AdminInput
                label={t("admin.intros.startSeconds")}
                mono
                type="number"
                value={startSeconds}
                onChange={(e) =>
                  setStartSeconds(Math.max(0, Number(e.target.value) || 0))
                }
                helperText={formatHms(startSeconds)}
                inputProps={{ min: 0, step: 1 }}
                fullWidth
              />
              <AdminButton
                variant="secondary"
                icon={<MapPin size={14} />}
                onClick={markStart}
                disabled={!episode.file_path}
                fullWidth
              >
                {t("admin.intros.markStart")}
              </AdminButton>
              <AdminInput
                label={t("admin.intros.endSeconds")}
                mono
                type="number"
                value={endSeconds}
                onChange={(e) =>
                  setEndSeconds(Math.max(0, Number(e.target.value) || 0))
                }
                helperText={formatHms(endSeconds)}
                inputProps={{ min: 1, step: 1 }}
                fullWidth
              />
              <AdminButton
                variant="secondary"
                icon={<MapPin size={14} />}
                onClick={markEnd}
                disabled={!episode.file_path}
                fullWidth
              >
                {t("admin.intros.markEnd")}
              </AdminButton>
            </Box>

            {validationError && <Alert severity="error">{validationError}</Alert>}

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              sx={{ pt: 0.5 }}
            >
              <AdminButton
                variant="primary"
                icon={<Save size={14} />}
                onClick={handleSave}
                disabled={!!validationError || setIntro.isPending || !episodeId}
              >
                {t("admin.intros.save")}
              </AdminButton>
              <AdminButton
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={handleClear}
                disabled={clearIntro.isPending || !episodeId || !episode.intro}
              >
                {t("admin.intros.clear")}
              </AdminButton>
              <AdminButton
                variant="secondary"
                icon={<ScrollText size={14} />}
                onClick={() => setCreditsOpen(true)}
                disabled={!episodeId}
              >
                {t("admin.credits.editButton")}
              </AdminButton>
              <Typography
                variant="metaMono"
                color="text.secondary"
                sx={{ alignSelf: "center", ml: "auto" }}
              >
                {t("admin.intros.currentTime")}: {formatHms(currentTime)}
              </Typography>
            </Stack>
          </Stack>
        </AdminCard>

        <AdminCard>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            flexWrap="wrap"
          >
            <AdminButton
              variant="secondary"
              icon={<Zap size={14} />}
              onClick={() => setPendingBulk("season")}
              disabled={
                !!validationError || bulkSet.isPending || eligibleInSeason.length === 0
              }
            >
              {t("admin.intros.applyToSeason")} ({eligibleInSeason.length})
            </AdminButton>
            <AdminButton
              variant="secondary"
              icon={<Zap size={14} />}
              onClick={() => setPendingBulk("series")}
              disabled={
                !!validationError || bulkSet.isPending || eligibleInSeries.length === 0
              }
            >
              {t("admin.intros.applyToSeries")} ({eligibleInSeries.length})
            </AdminButton>
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
              sx={{ ml: { sm: 0 } }}
            />
          </Stack>
        </AdminCard>
      </Stack>

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
              bgcolor:
                toast.severity === "success"
                  ? alpha(status.ok.base, 0.15)
                  : alpha(status.err.base, 0.18),
              border: `1px solid ${whiteAlpha(0.08)}`,
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
        bgcolor: whiteAlpha(0.06),
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
          bgcolor: accentGold,
        }}
      />
    </Box>
  );
}
